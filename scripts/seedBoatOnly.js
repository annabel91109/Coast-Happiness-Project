// One-shot script: stamp `boatOnly: true` onto beaches that are only
// reachable by kaito / ferry — no road and no foot trail. Cleanup
// organisers need to know this up front because it changes how they
// transport gear and people.

const fs = require("fs");
const path = require("path");

const BOAT_ONLY = new Set([
  // Sharp Island — accessible only by kaito from Sai Kung pier
  "Hap Mun Bay Beach",
  "Kiu Tsui Beach",
  "Trio Beach",
  // Tap Mun island — ferry from Wong Shek / Ma Liu Shui
  "Tap Mun Beach",
  // Ap Chau (Robinson Island) — kaito from Ma Liu Shui (weekends only)
  "Ap Chau",
]);

function patch(file) {
  const full = path.resolve(file);
  const beaches = JSON.parse(fs.readFileSync(full, "utf8"));
  let stamped = 0;
  for (const b of beaches) {
    if (BOAT_ONLY.has(b.name)) {
      b.boatOnly = true;
      stamped++;
    } else if ("boatOnly" in b) {
      delete b.boatOnly;
    }
  }
  fs.writeFileSync(full, JSON.stringify(beaches, null, 2) + "\n");
  console.log(`[${file}] boat-only stamped=${stamped}, total=${beaches.length}`);
}

patch("functions/data/beaches.json");
patch("server/data/beaches.json");
