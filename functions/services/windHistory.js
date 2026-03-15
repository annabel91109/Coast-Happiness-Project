const { getFirestore } = require("firebase-admin/firestore");

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

// In-memory cache of snapshots loaded from Firestore
let history = [];
let lastLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // reload from Firestore every 5 min

// Seed data from the bundled JSON (for snapshots collected before Firestore migration)
let seedData = null;
try {
  seedData = require("../data/wind-history.json");
} catch (e) {
  seedData = [];
}

async function loadFromFirestore() {
  const now = Date.now();
  if (history.length > 0 && now - lastLoadedAt < CACHE_TTL_MS) return;

  const db = getFirestore("default");
  const cutoff = now - PERIOD_MS["12m"];
  const snap = await db
    .collection("windSnapshots")
    .where("timestamp", ">=", cutoff)
    .orderBy("timestamp", "asc")
    .get();

  const firestoreData = snap.docs.map((doc) => doc.data());

  // Merge seed data (old) with Firestore data (new), deduplicate by timestamp
  const seen = new Set(firestoreData.map((s) => s.timestamp));
  const relevantSeed = seedData.filter(
    (s) => s.timestamp >= cutoff && !seen.has(s.timestamp)
  );
  history = [...relevantSeed, ...firestoreData].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  lastLoadedAt = now;
}

async function append(stations) {
  const entry = { timestamp: Date.now(), stations };
  const db = getFirestore("default");
  await db.collection("windSnapshots").add(entry);
  history.push(entry);
  return entry;
}

async function getSnapshots(period) {
  await loadFromFirestore();
  const ms = PERIOD_MS[period];
  if (!ms) return [];
  const cutoff = Date.now() - ms;
  return history.filter((entry) => entry.timestamp >= cutoff);
}

async function getSnapshotsByRange(fromMs, toMs) {
  await loadFromFirestore();
  return history.filter((e) => e.timestamp >= fromMs && e.timestamp <= toMs);
}

function getValidPeriods() {
  return Object.keys(PERIOD_MS);
}

module.exports = { getSnapshots, getSnapshotsByRange, getValidPeriods, append, PERIOD_MS };
