const MARINE_URL =
  "https://marine-api.open-meteo.com/v1/marine" +
  "?latitude=22.25&longitude=114.15" +
  "&hourly=wave_height,wave_direction,wave_period" +
  "&timezone=Asia%2FHong_Kong&forecast_days=1";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_INTERVAL_MS = 60 * 60 * 1000;

let cache = {
  data: null,
  fetchedAt: null,
};

let intervalId = null;

async function fetchMarineData() {
  const res = await fetch(MARINE_URL);
  if (!res.ok) {
    throw new Error(`Open-Meteo Marine API returned ${res.status}: ${res.statusText}`);
  }
  const json = await res.json();

  const hourIndex = new Date().getHours();
  const waveHeight = json.hourly?.wave_height?.[hourIndex] ?? null;
  const waveDirection = json.hourly?.wave_direction?.[hourIndex] ?? null;
  const wavePeriod = json.hourly?.wave_period?.[hourIndex] ?? null;

  const data = { waveHeight, waveDirection, wavePeriod };

  cache.data = data;
  cache.fetchedAt = Date.now();

  console.log(
    `[marineFetcher] Fetched wave data at ${new Date().toISOString()} — height: ${waveHeight}m, dir: ${waveDirection}°, period: ${wavePeriod}s`
  );

  return data;
}

function getCachedMarine() {
  if (!cache.data) return null;

  const age = Date.now() - cache.fetchedAt;
  return {
    ...cache.data,
    fetchedAt: new Date(cache.fetchedAt).toISOString(),
    ageSeconds: Math.round(age / 1000),
    stale: age > CACHE_TTL_MS,
  };
}

async function getMarineData() {
  const age = cache.fetchedAt ? Date.now() - cache.fetchedAt : Infinity;

  if (cache.data && age < CACHE_TTL_MS) {
    return getCachedMarine();
  }

  await fetchMarineData();
  return getCachedMarine();
}

function startPolling() {
  if (intervalId) return;

  fetchMarineData().catch((err) => {
    console.error("[marineFetcher] Initial fetch failed:", err.message);
  });

  intervalId = setInterval(() => {
    fetchMarineData().catch((err) => {
      console.error("[marineFetcher] Scheduled fetch failed:", err.message);
    });
  }, FETCH_INTERVAL_MS);

  console.log(`[marineFetcher] Polling started (every ${FETCH_INTERVAL_MS / 1000 / 60}min)`);
}

function stopPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[marineFetcher] Polling stopped");
  }
}

module.exports = { getMarineData, getCachedMarine, startPolling, stopPolling };
