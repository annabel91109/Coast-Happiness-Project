// One-shot script: stamp `hikeMinutes` (one-way, on foot from the nearest
// road/ferry endpoint) onto every beach that genuinely requires a hike of
// 20 minutes or more.
//
// Beaches reached by a short paved walk from a bus stop are NOT considered
// hikes and are deliberately omitted (they get an undefined value).
//
// Times are conservative averages for a moderately fit walker. Trail
// references: AFCD HK Trails, Lantau Trail, MacLehose Trail Stage 2, the
// Tai Long Wan / Sai Wan Pavilion shuttle route, and Lamma Family Trail.

const fs = require("fs");
const path = require("path");

const HIKE_MINUTES = {
  // ---- HK Island ----
  "Rocky Bay": 20,                     // informal coastal trail off Shek O Rd

  // ---- Lantau ----
  "Nim Shue Wan": 25,                  // trail from Discovery Bay south
  "Po Chue Tam": 25,                   // coastal walk west of Tai O
  "Cheung Sha Lan, Lantau Island": 30, // trail past Discovery Bay
  "Sam Pak Wan, Lantau": 30,
  "Yi Long Wan Beach": 120,            // remote south Lantau via Chi Ma Wan trail
  "Chi Ma Wan": 90,                    // Chi Ma Wan Country Trail from Pui O
  "Fan Lau Beach": 120,                // Lantau Trail Stage 7 from Tai O

  // ---- Lamma ----
  "Power Station Beach": 25,           // trail from Yung Shue Wan
  "Lo Tik Wan, Lamma": 25,
  "Mo Tat Wan, Lamma": 20,             // family trail from Sok Kwu Wan
  "Shek Pai Wan, Lamma": 35,
  "Sham Wan": 30,                      // restricted access during turtle nesting

  // ---- Sai Kung ----
  "Lung Ha Wan": 30,                   // from Clearwater Bay Country Park
  "Pak Shui Wun": 35,                  // High Junk Peak Country Trail
  "Tai Long Wan": 150,                 // Sai Wan Pavilion → Ham Tin → Tai Wan
  "Sai Wan Beach": 60,                 // Sai Wan Pavilion shuttle drop
  "Long Ke Wan": 45,                   // from East Dam parking, High Island
  "Chek Keng Beach": 90,               // MacLehose Stage 2 from Pak Tam Au
};

function patch(file) {
  const full = path.resolve(file);
  const beaches = JSON.parse(fs.readFileSync(full, "utf8"));
  let stamped = 0;
  for (const b of beaches) {
    if (Object.prototype.hasOwnProperty.call(HIKE_MINUTES, b.name)) {
      b.hikeMinutes = HIKE_MINUTES[b.name];
      stamped++;
    } else if ("hikeMinutes" in b) {
      delete b.hikeMinutes;
    }
  }
  fs.writeFileSync(full, JSON.stringify(beaches, null, 2) + "\n");
  console.log(`[${file}] hike-stamped=${stamped}, total=${beaches.length}`);
}

patch("functions/data/beaches.json");
patch("server/data/beaches.json");
