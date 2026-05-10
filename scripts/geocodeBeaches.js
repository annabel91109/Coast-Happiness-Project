#!/usr/bin/env node
/**
 * Re-geocode beaches.json using Google Maps Geocoding API.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=your_key node scripts/geocodeBeaches.js
 *
 * Get a key:
 *   1. https://console.cloud.google.com/google/maps-apis/credentials
 *   2. Enable "Geocoding API" for your project
 *   3. Create an API key (restrict it to Geocoding API for safety)
 *
 * The script reads server/data/beaches.json, queries each beach by name,
 * keeps only results within Hong Kong's bounding box, and writes the
 * updated file in place. Also mirrors to functions/data/beaches.json.
 *
 * Run again any time. Beaches with no good match keep their existing coords.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error("ERROR: Set GOOGLE_MAPS_API_KEY env var.");
  process.exit(1);
}

const SERVER_PATH = path.join(__dirname, "..", "server", "data", "beaches.json");
const FUNCTIONS_PATH = path.join(__dirname, "..", "functions", "data", "beaches.json");

// Hong Kong bounding box
const HK_BOUNDS = { minLat: 22.1, maxLat: 22.6, minLng: 113.8, maxLng: 114.5 };

function inHk(lat, lng) {
  return lat >= HK_BOUNDS.minLat && lat <= HK_BOUNDS.maxLat &&
         lng >= HK_BOUNDS.minLng && lng <= HK_BOUNDS.maxLng;
}

function geocode(query) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&bounds=22.1,113.8|22.6,114.5&region=hk&key=${API_KEY}`;
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const beaches = JSON.parse(fs.readFileSync(SERVER_PATH, "utf8"));
  console.log(`Loaded ${beaches.length} beaches.`);

  let updated = 0;
  let skipped = 0;

  for (const b of beaches) {
    const queries = [
      `${b.name} Beach, Hong Kong`,
      `${b.name}, Hong Kong`,
    ];

    let best = null;
    for (const q of queries) {
      try {
        const result = await geocode(q);
        if (result.status === "OK" && result.results.length > 0) {
          // Find first result inside HK bounds
          const hit = result.results.find((r) => {
            const { lat, lng } = r.geometry.location;
            return inHk(lat, lng);
          });
          if (hit) {
            best = hit;
            break;
          }
        } else if (result.status === "OVER_QUERY_LIMIT") {
          console.error("OVER_QUERY_LIMIT — pausing 2s and retrying");
          await sleep(2000);
        } else if (result.status !== "ZERO_RESULTS") {
          console.warn(`  [${b.name}] status: ${result.status} - ${result.error_message || ""}`);
        }
      } catch (err) {
        console.warn(`  [${b.name}] geocode error: ${err.message}`);
      }
      await sleep(120); // be kind to the API
    }

    if (best) {
      const { lat, lng } = best.geometry.location;
      const oldLat = b.lat;
      const oldLng = b.lng;
      b.lat = Math.round(lat * 10000) / 10000;
      b.lng = Math.round(lng * 10000) / 10000;
      b.placeId = best.place_id;
      const moved = Math.sqrt((lat - oldLat) ** 2 + (lng - oldLng) ** 2) * 111;
      console.log(`✓ ${b.name.padEnd(30)} ${oldLat},${oldLng} → ${b.lat},${b.lng}  (~${moved.toFixed(2)} km)  [${best.formatted_address}]`);
      updated++;
    } else {
      console.log(`✗ ${b.name.padEnd(30)} no match — keeping ${b.lat},${b.lng}`);
      skipped++;
    }
  }

  fs.writeFileSync(SERVER_PATH, JSON.stringify(beaches, null, 2) + "\n");
  fs.writeFileSync(FUNCTIONS_PATH, JSON.stringify(beaches, null, 2) + "\n");
  console.log(`\nDone. Updated: ${updated}, skipped: ${skipped}.`);
  console.log(`Wrote ${SERVER_PATH}`);
  console.log(`Wrote ${FUNCTIONS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
