const fs = require("fs");
const path = require("path");

const HISTORY_FILE = path.join(__dirname, "../data/wind-history.json");
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 12 months

let history = [];

function load() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
      console.log(`[windHistory] Loaded ${history.length} snapshots`);
    }
  } catch (err) {
    console.error("[windHistory] Failed to load:", err.message);
    history = [];
  }
}

function save() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));
  } catch (err) {
    console.error("[windHistory] Failed to save:", err.message);
  }
}

function append(stations) {
  const timestamp = Date.now();
  history.push({ timestamp, stations });

  // Prune entries older than MAX_AGE_MS
  const cutoff = timestamp - MAX_AGE_MS;
  const before = history.length;
  history = history.filter((entry) => entry.timestamp >= cutoff);
  if (history.length < before) {
    console.log(`[windHistory] Pruned ${before - history.length} old entries`);
  }

  save();
}

const PERIOD_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "2w": 14 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
  "3m": 90 * 24 * 60 * 60 * 1000,
  "6m": 180 * 24 * 60 * 60 * 1000,
  "12m": 365 * 24 * 60 * 60 * 1000,
};

function getSnapshots(period) {
  const ms = PERIOD_MS[period];
  if (!ms) return [];
  const cutoff = Date.now() - ms;
  return history.filter((entry) => entry.timestamp >= cutoff);
}

function getValidPeriods() {
  return Object.keys(PERIOD_MS);
}

function getSnapshotsByRange(fromMs, toMs) {
  return history.filter((e) => e.timestamp >= fromMs && e.timestamp <= toMs);
}

module.exports = { load, append, getSnapshots, getSnapshotsByRange, getValidPeriods, PERIOD_MS };
