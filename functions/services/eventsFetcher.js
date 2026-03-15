const EPD_EVENTS_URL =
  "https://www.epd.gov.hk/epd/clean_shorelines/data/events.json";

const CACHE_TTL_MS = 60 * 60 * 1000;

let cache = { events: null, fetchedAt: null };

async function fetchEvents() {
  const res = await fetch(EPD_EVENTS_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`EPD fetch failed: ${res.status}`);
  const json = await res.json();

  cache = { events: json.events, fetchedAt: new Date().toISOString() };
  return cache;
}

async function getCachedEvents() {
  if (cache.events) {
    const age = Date.now() - new Date(cache.fetchedAt).getTime();
    if (age < CACHE_TTL_MS) return cache;
  }
  return fetchEvents();
}

module.exports = { getCachedEvents };
