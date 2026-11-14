const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

app.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@') || String(password || '').length < 6) {
    return res.json({ status: 'error', message: 'Enter a valid email and a password of at least 6 characters.' });
  }

  const users = loadUsers();
  if (users[cleanEmail]) {
    return res.json({ status: 'error', message: 'An account with this email already exists. Please log in.' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const displayName = String(name || cleanEmail.split('@')[0]).trim();

  users[cleanEmail] = { name: displayName, email: cleanEmail, salt, hash, createdAt: new Date().toISOString() };
  saveUsers(users);

  const token = crypto.randomBytes(24).toString('hex');
  return res.json({ status: 'success', user: { name: displayName, email: cleanEmail, token } });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = String(email || '').trim().toLowerCase();
  const users = loadUsers();
  const record = users[cleanEmail];

  if (!record) {
    return res.json({ status: 'error', message: 'No account found with that email. Switch to Sign Up first.' });
  }

  const attemptHash = hashPassword(String(password || ''), record.salt);
  if (attemptHash !== record.hash) {
    return res.json({ status: 'error', message: 'Incorrect password. Please try again.' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  return res.json({ status: 'success', user: { name: record.name, email: record.email, token } });
});

function extractIataCode(inputStr, fallback = '') {
  if (!inputStr) return fallback;
  const trimmed = String(inputStr).trim();
  if (trimmed.includes('(') && trimmed.includes(')')) {
    const inside = trimmed.split('(').pop().split(')').shift().trim().toUpperCase();
    if (inside.length === 3) return inside;
  }
  if (trimmed.length === 3) return trimmed.toUpperCase();
  return fallback;
}

app.post('/search', (req, res) => {
  const { origin, destination, specific_date, target_weekday, trip_duration_type, max_budget, baggage_type } = req.body;

  const originCode = extractIataCode(origin, 'DUB');
  const destCode = extractIataCode(destination, '');
  const durationType = trip_duration_type || 'daytrip';
  const budgetVal = Number(max_budget) || 150;
  const dateFilter = specific_date ? String(specific_date).trim() : '';
  const weekdayFilter = target_weekday !== undefined && target_weekday !== null ? String(target_weekday).trim() : '';

  const scriptPath = path.join(__dirname, 'ryanair_fetch.py');
  const pyProcess = spawn('python', [scriptPath, originCode, destCode, durationType, String(budgetVal), dateFilter, weekdayFilter]);

  let stdoutData = '';
  let stderrData = '';

  pyProcess.stdout.on('data', (chunk) => { stdoutData += chunk.toString(); });
  pyProcess.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

  pyProcess.on('close', () => {
    if (stderrData) console.error('Python stderr:', stderrData);
    try {
      const parsed = JSON.parse(stdoutData.trim());
      if (parsed.status === 'success') {
        let deals = parsed.deals || [];
        const bagAddon = baggage_type === 'cabin' ? 24 : baggage_type === 'checked' ? 45 : 0;
        if (bagAddon > 0) {
          deals = deals.map((d) => ({
            ...d,
            total_price: Number((Number(d.total_price) + bagAddon).toFixed(2))
          })).filter((d) => d.total_price <= budgetVal);
        }
        return res.json({ status: 'success', deals });
      } else {
        return res.json({ status: 'error', message: parsed.message || 'Python script error.' });
      }
    } catch (err) {
      return res.status(500).json({ status: 'error', message: 'Could not read response from ryanair_fetch.py.' });
    }
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`VayaGo Hybrid Engine + Fan Auth running on port ${PORT}`);
});