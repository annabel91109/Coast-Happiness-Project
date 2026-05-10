// One-shot fix: correct misplaced beach coordinates and remove duplicate
// entries in functions/data/beaches.json and server/data/beaches.json.
//
// Bug source: the original geocoding pass returned wrong placeIds for several
// beaches (e.g. Cheung Chau beaches landing in Sai Kung), and a few entries
// are pure duplicates of another (same coords, same TC name).

const fs = require("fs");
const path = require("path");

// name → corrected { lat, lng }. Verified against HK geography.
const COORD_FIXES = {
  // Cheung Chau (the island sits at lat ~22.20, lng ~114.03)
  "Tung Wan Beach":   { lat: 22.2095, lng: 114.0341 }, // east-side main beach
  "Italian Beach":    { lat: 22.2050, lng: 114.0298 }, // south Cheung Chau
  "Afternoon Beach":  { lat: 22.2018, lng: 114.0286 }, // south Cheung Chau

  // Tuen Mun — Golden Beach was sharing Afternoon Beach's wrong coords
  "Golden Beach":     { lat: 22.3935, lng: 113.9744 }, // Castle Peak Bay

  // Sai Kung — Sai Wan was sharing Tai Long Wan's coords; both are in
  // the Tai Long Wan group but distinct beaches.
  "Sai Wan Beach":    { lat: 22.3953, lng: 114.3580 },
};

// Names of pure-duplicate entries to drop. Each has identical lat/lng AND
// identical nameTc to another entry already in the file.
const DROP_NAMES = new Set([
  "Lung Mei (Tai Po North)",     // duplicate of "Tai Po Lung Mei Beach"
  "Lung Ha Wan (Hebe Haven)",    // duplicate of "Lung Ha Wan"
]);

function patch(file) {
  const full = path.resolve(file);
  const beaches = JSON.parse(fs.readFileSync(full, "utf8"));
  let fixed = 0;
  let dropped = 0;
  const out = [];
  for (const b of beaches) {
    if (DROP_NAMES.has(b.name)) {
      dropped++;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(COORD_FIXES, b.name)) {
      const c = COORD_FIXES[b.name];
      b.lat = c.lat;
      b.lng = c.lng;
      fixed++;
    }
    out.push(b);
  }
  fs.writeFileSync(full, JSON.stringify(out, null, 2) + "\n");
  console.log(`[${file}] fixed=${fixed}, dropped=${dropped}, total=${out.length}`);
}

patch("functions/data/beaches.json");
patch("server/data/beaches.json");
