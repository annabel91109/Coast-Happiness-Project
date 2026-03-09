const fs = require("fs");
const path = require("path");

const EPD_EVENTS_URL =
  "https://www.epd.gov.hk/epd/clean_shorelines/data/events.json";
const CACHE_FILE = path.join(__dirname, "../data/events-cache.json");
const FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cache = { events: null, fetchedAt: null };
let intervalId = null;

function loadFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      cache = raw;
      console.log(
        `[eventsFetcher] Loaded ${cache.events.length} events from disk (fetched ${cache.fetchedAt})`
      );
    }
  } catch (err) {
    console.error("[eventsFetcher] Failed to load cache from disk:", err.message);
  }
}

function saveToDisk() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch (err) {
    console.error("[eventsFetcher] Failed to save cache to disk:", err.message);
  }
}

async function fetchEvents() {
  const res = await fetch(EPD_EVENTS_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`EPD fetch failed: ${res.status}`);
  const json = await res.json();

  cache = { events: json.events, fetchedAt: new Date().toISOString() };
  saveToDisk();

  console.log(
    `[eventsFetcher] Fetched ${json.events.length} events at ${cache.fetchedAt}`
  );
}

function getCachedEvents() {
  return cache;
}

function startPolling() {
  if (intervalId) return;

  loadFromDisk();

  // Fetch immediately on startup only if cache is missing or stale (>24h)
  const age = cache.fetchedAt
    ? Date.now() - new Date(cache.fetchedAt).getTime()
    : Infinity;

  if (age >= FETCH_INTERVAL_MS) {
    fetchEvents().catch((err) => {
      console.error("[eventsFetcher] Initial fetch failed:", err.message);
    });
  }

  intervalId = setInterval(() => {
    fetchEvents().catch((err) => {
      console.error("[eventsFetcher] Scheduled fetch failed:", err.message);
    });
  }, FETCH_INTERVAL_MS);

  console.log("[eventsFetcher] Polling started (every 24h)");
}

function stopPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[eventsFetcher] Polling stopped");
  }
}

module.exports = { startPolling, stopPolling, getCachedEvents };
