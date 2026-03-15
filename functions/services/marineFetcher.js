const MARINE_URL =
  "https://marine-api.open-meteo.com/v1/marine" +
  "?latitude=22.25&longitude=114.15" +
  "&hourly=wave_height,wave_direction,wave_period" +
  "&timezone=Asia%2FHong_Kong&forecast_days=1";

const CACHE_TTL_MS = 60 * 60 * 1000;

let cache = { data: null, fetchedAt: null };

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

  return data;
}

async function getMarineData() {
  const age = cache.fetchedAt ? Date.now() - cache.fetchedAt : Infinity;
  if (cache.data && age < CACHE_TTL_MS) {
    return { ...cache.data, fetchedAt: new Date(cache.fetchedAt).toISOString(), ageSeconds: Math.round((Date.now() - cache.fetchedAt) / 1000), stale: false };
  }
  await fetchMarineData();
  return { ...cache.data, fetchedAt: new Date(cache.fetchedAt).toISOString(), ageSeconds: 0, stale: false };
}

module.exports = { getMarineData };
