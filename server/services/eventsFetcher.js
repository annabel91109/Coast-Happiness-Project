const fs = require("fs");
const path = require("path");

// HandsOn HK exposes the volunteer.handsonhongkong.org/environment listing as
// a JSON-returning AJAX endpoint. The block IDs are baked into the page HTML
// (searchResultId=1673, parentBlockId=76160) and are stable. The form posts
// the issue-area filter as a multi-select, which Solr ANDs against the rest
// of the saved block configuration.
const HANDSON_URL =
  "https://volunteer.handsonhongkong.org/search/GetOpportunitiesSearchResultBlockGrid";
const HANDSON_REFERER =
  "https://volunteer.handsonhongkong.org/environment?layoutViewMode=tablet";

const CACHE_FILE = path.join(__dirname, "../data/events-cache.json");
const FETCH_INTERVAL_MS = 6 * 60 * 60 * 1000;

let cache = { events: null, fetchedAt: null };
let intervalId = null;

function loadFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      cache = raw;
      console.log(
        `[eventsFetcher] Loaded ${cache.events?.length ?? 0} events from disk (fetched ${cache.fetchedAt})`
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

function buildBody(currentRows) {
  const params = new URLSearchParams();
  params.set("blockId", "1673");
  params.set("parentBlockId", "76160");
  params.set("currentRows", String(currentRows));
  params.set("isSearch", "true");
  params.set("parameters[distance]", "Any");
  params.set("parameters[issue-areas][]", "Environmental Conservation");
  params.set("parameters[solrQuery]", "");
  return params.toString();
}

async function fetchOnePage(currentRows) {
  const res = await fetch(HANDSON_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0",
      Referer: HANDSON_REFERER,
    },
    body: buildBody(currentRows),
  });
  if (!res.ok) throw new Error(`HandsOn fetch failed: ${res.status}`);
  return res.json();
}

// Flatten the HandsOn payload (grouped by day) into a flat list. The page
// returns 50 occurrences per request; paginate until we have everything.
async function fetchEvents() {
  const all = [];
  let total = Infinity;
  let cursor = 0;
  while (cursor < total) {
    const page = await fetchOnePage(cursor);
    total = typeof page.total === "number" ? page.total : 0;
    const days = page.opportunities || [];
    let pageCount = 0;
    for (const day of days) {
      for (const opp of day.ListingOpportunities || []) {
        all.push({ ...opp, _dayDate: day.DateOccurrences });
        pageCount++;
      }
    }
    if (pageCount === 0) break;
    cursor += pageCount;
    if (cursor >= total) break;
  }

  cache = { events: all, fetchedAt: new Date().toISOString() };
  saveToDisk();
  console.log(
    `[eventsFetcher] Fetched ${all.length} HandsOn HK events at ${cache.fetchedAt}`
  );
}

function getCachedEvents() {
  return cache;
}

function startPolling() {
  if (intervalId) return;

  loadFromDisk();

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

  console.log("[eventsFetcher] Polling started (every 6h)");
}

function stopPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[eventsFetcher] Polling stopped");
  }
}

module.exports = { startPolling, stopPolling, getCachedEvents };
