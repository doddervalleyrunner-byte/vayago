const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const distPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(distPath));

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

  console.log(`Scanning Ryanair [${originCode}] -> [${destCode || 'ALL'}] | Type: ${durationType} | Day: ${weekdayFilter || 'Any'} | Date: ${dateFilter || 'Any'}`);

  const scriptPath = path.join(__dirname, 'ryanair_fetch.py');
  const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
  const pyProcess = spawn(pyCmd, [scriptPath, originCode, destCode, durationType, String(budgetVal), dateFilter, weekdayFilter]);

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
        console.log(`Found ${deals.length} live deals.`);
        return res.json({ status: 'success', deals });
      }
      return res.json({ status: 'error', message: parsed.message || 'Python script error.' });
    } catch {
      return res.status(500).json({ status: 'error', message: 'Could not read response from ryanair_fetch.py.' });
    }
  });
});

// Express v5-safe fallback route
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`VayaGo Local Engine running on port ${PORT}`);
});