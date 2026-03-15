const { parse } = require("csv-parse/sync");

const HKO_CSV_URL =
  "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_10min_wind.csv";

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = { data: null, fetchedAt: null };

function isNumeric(val) {
  if (val === undefined || val === null || val === "") return false;
  return !Number.isNaN(Number(val));
}

function parseWindCSV(csvText) {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  return records.map((row) => {
    const station = row["Automatic Weather Station"];
    const direction = row["10-Minute Mean Wind Direction(Compass points)"];
    const speed = row["10-Minute Mean Speed(km/hour)"];
    const gust = row["10-Minute Maximum Gust(km/hour)"];
    const datetime = row["Date time"];

    return {
      station,
      direction: direction || "Calm",
      speed: isNumeric(speed) ? Number(speed) : null,
      gust: isNumeric(gust) ? Number(gust) : null,
      datetime,
    };
  });
}

async function fetchWindData() {
  const res = await fetch(HKO_CSV_URL);
  if (!res.ok) {
    throw new Error(`HKO API returned ${res.status}: ${res.statusText}`);
  }
  const csvText = await res.text();
  const data = parseWindCSV(csvText);

  cache.data = data;
  cache.fetchedAt = Date.now();

  return data;
}

function getCachedWind() {
  if (!cache.data) return null;
  const age = Date.now() - cache.fetchedAt;
  return {
    stations: cache.data,
    fetchedAt: new Date(cache.fetchedAt).toISOString(),
    ageSeconds: Math.round(age / 1000),
    stale: age > CACHE_TTL_MS,
  };
}

async function getWindData() {
  const age = cache.fetchedAt ? Date.now() - cache.fetchedAt : Infinity;
  if (cache.data && age < CACHE_TTL_MS) {
    return getCachedWind();
  }
  await fetchWindData();
  return getCachedWind();
}

module.exports = { getWindData, getCachedWind };
