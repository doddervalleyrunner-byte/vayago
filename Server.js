const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Your unique, unguessable 32-character admin access key
const ADMIN_SECRET_KEY = process.env.ADMIN_KEY || 'vyg_94k2m8x7p1q6z3w5n9b4v2c8j7h5f1d0';

const distPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(distPath));

const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return {}; }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// Verify unique admin URL token on the server
app.post('/admin-auth', (req, res) => {
  const { key } = req.body;
  if (key && String(key).trim() === ADMIN_SECRET_KEY) {
    const token = crypto.randomBytes(24).toString('hex');
    return res.json({
      status: 'success',
      user: { name: 'Jamie (Admin)', email: 'admin@vayago.local', token, isAdmin: true }
    });
  }
  return res.status(401).json({ status: 'error', message: 'Invalid admin passkey.' });
});

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
  if (!record) return res.json({ status: 'error', message: 'No account found with that email.' });
  const attemptHash = hashPassword(String(password || ''), record.salt);
  if (attemptHash !== record.hash) return res.json({ status: 'error', message: 'Incorrect password.' });
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
  const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
  const pyProcess = spawn(pyCmd, [scriptPath, originCode, destCode, durationType, String(budgetVal), dateFilter, weekdayFilter]);

  let stdoutData = '';
  pyProcess.stdout.on('data', (chunk) => { stdoutData += chunk.toString(); });
  pyProcess.on('close', () => {
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
      }
      return res.json({ status: 'error', message: parsed.message || 'Python script error.' });
    } catch {
      return res.status(500).json({ status: 'error', message: 'Could not read response from ryanair_fetch.py.' });
    }
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`VayaGo Production Server running on port ${PORT}`);
});