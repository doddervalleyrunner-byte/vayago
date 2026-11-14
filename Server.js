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

  const scriptPath = path.join(__dirname, 'ryanair_fetch.py');
  const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
  const pyProcess = spawn(pyCmd, [scriptPath, originCode, destCode, durationType, String(budgetVal), dateFilter, weekdayFilter]);

  let stdoutData = '';
  let stderrData = '';

  pyProcess.stdout.on('data', (chunk) => { stdoutData += chunk.toString(); });
  pyProcess.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

  pyProcess.on('close', () => {
    try {
      const lines = stdoutData.trim().split('\n');
      const lastLine = lines[lines.length - 1] || '';
      const parsed = JSON.parse(lastLine);
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
      const detail = (stderrData || stdoutData || 'Empty output from Python').slice(0, 220);
      return res.status(500).json({ status: 'error', message: `Python error: ${detail}` });
    }
  });
});

app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`VayaGo Server running on port ${PORT}`);
});