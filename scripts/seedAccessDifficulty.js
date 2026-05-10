// One-shot script: stamp an `accessDifficulty` (1–5) onto every beach in
// functions/data/beaches.json and server/data/beaches.json.
//
// Scale (how hard it is to physically reach the beach):
//   1 = Easy         — direct MTR/bus to beachfront, step-free
//   2 = Moderate     — public transport + short (<15 min) walk on paved paths
//   3 = Intermediate — longer walk, steep steps, or end-of-line bus + trail
//   4 = Challenging  — 30+ min hike, kaito required, or remote
//   5 = Expert       — long hike (1 hr+), boat-only, or restricted access

const fs = require("fs");
const path = require("path");

const DIFFICULTY = {
  // ---- HK Island ----
  "Repulse Bay": 1,
  "Deep Water Bay": 1,
  "Stanley Main Beach": 1,
  "Middle Bay": 2,
  "South Bay": 2,
  "St. Stephen's Beach": 2,
  "Chung Hom Kok Beach": 2,
  "Shek O": 2,
  "Shek O Main Beach": 2,
  "Big Wave Bay": 3,
  "Turtle Cove Beach": 3,
  "Hairpin Beach": 3,
  "Shek O Back Beach": 3,
  "Sandy Bay": 3,
  "Rocky Bay": 4,

  // ---- Lantau ----
  "Mui Wo Beach": 1,
  "Pui O": 2,
  "Cheung Sha Upper Beach": 2,
  "Cheung Sha Lower Beach": 2,
  "Tong Fuk Beach": 2,
  "Discovery Bay Tai Pak Beach": 2,
  "Shui Hau Wan": 3,
  "Tung Chung Bay": 3,
  "Nim Shue Wan": 4,
  "Po Chue Tam": 4,
  "Cheung Sha Lan, Lantau Island": 4,
  "Sam Pak Wan, Lantau": 4,
  "Yi Long Wan Beach": 5,
  "Chi Ma Wan": 5,
  "Fan Lau Beach": 5,

  // ---- Lamma ----
  "Hung Shing Yeh Beach": 2,
  "Sok Kwu Wan": 2,
  "Lo So Shing Beach": 3,
  "Power Station Beach": 4,
  "Shek Pai Wan, Lamma": 4,
  "Mo Tat Wan, Lamma": 4,
  "Lo Tik Wan, Lamma": 4,
  "Sham Wan": 5,

  // ---- Cheung Chau ----
  "Tung Wan Beach": 1,
  "Kwun Yam Wan Beach": 2,
  "Italian Beach": 3,
  "Afternoon Beach": 3,

  // ---- Sai Kung ----
  "Silverstrand Beach": 1,
  "Clear Water Bay First Beach": 2,
  "Clear Water Bay Second Beach": 2,
  "Pak Sha Wan (Hebe Haven)": 2,
  "Sha Ha, Sai Kung": 2,
  "Trio Beach": 3,
  "Hap Mun Bay Beach": 3,
  "Kiu Tsui Beach": 3,
  "Hoi Ha Beach": 3,
  "Sheung Sze Wan, Sai Kung": 3,
  "Little Palm Beach, Sai Kung": 3,
  "Lung Ha Wan": 4,
  "Lung Ha Wan (Hebe Haven)": 4,
  "Pak Shui Wun": 4,
  "Tap Mun Beach": 4,
  "Tai Long Wan": 5,
  "Sai Wan Beach": 5,
  "Long Ke Wan": 5,
  "Chek Keng Beach": 5,

  // ---- Tuen Mun ----
  "Golden Beach": 1,
  "Butterfly Beach": 1,
  "Cafeteria Old Beach": 2,
  "Cafeteria New Beach": 2,
  "Kadoorie Beach": 2,
  "Castle Peak Beach": 2,
  "Lung Kwu Tan": 4,
  "Lung Kwu Sheung Tan": 4,

  // ---- Tsuen Wan ----
  "Anglers' Beach": 2,
  "Gemini Beaches": 2,
  "Casam Beach": 2,
  "Hoi Mei Wan Beach": 2,
  "Lido Beach": 2,
  "Ting Kau Beach": 2,
  "Approach Beach": 2,
  "Ma Wan Tung Wan Beach": 2,

  // ---- Tai Po ----
  "Tai Po Lung Mei Beach": 2,
  "Lung Mei (Tai Po North)": 2,
  "Sam Mun Tsai, Tai Po": 3,

  // ---- Sha Tin ----
  "Wu Kai Sha Pebbles Beach": 2,
  "Starfish Bay": 3,
  "To Tau Wan": 3,

  // ---- Peng Chau ----
  "Peng Chau Tung Wan Beach": 2,

  // ---- North ----
  "Ap Chau": 5,
  "Yung Shue Au": 5,
};

const DEFAULT_DIFFICULTY = 3;

function patch(file) {
  const full = path.resolve(file);
  const beaches = JSON.parse(fs.readFileSync(full, "utf8"));
  let stamped = 0;
  let defaulted = 0;
  for (const b of beaches) {
    if (Object.prototype.hasOwnProperty.call(DIFFICULTY, b.name)) {
      b.accessDifficulty = DIFFICULTY[b.name];
      stamped++;
    } else {
      b.accessDifficulty = DEFAULT_DIFFICULTY;
      defaulted++;
      console.warn(`  [default] ${b.name}`);
    }
  }
  fs.writeFileSync(full, JSON.stringify(beaches, null, 2) + "\n");
  console.log(`[${file}] stamped=${stamped}, defaulted=${defaulted}, total=${beaches.length}`);
}

patch("functions/data/beaches.json");
patch("server/data/beaches.json");
