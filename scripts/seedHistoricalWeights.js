// One-shot script: stamp a `historicalWeight` (0–1) onto every beach in
// functions/data/beaches.json and server/data/beaches.json.
//
// Values are a prior — rough estimates based on the EPD coastal-cleanup
// hotspot priority list and well-documented NGO cleanup reports (Plastic
// Free Seas, A Plastic Ocean, Green Power). Refine against actual EPD
// monthly tonnage data when available.

const fs = require("fs");
const path = require("path");

// Tier 5 — documented EPD priority hotspots / chronic debris accumulators
const HOTSPOT = 0.95;
// Tier 4 — non-gazetted, high Pearl-River / NE-monsoon exposure
const HIGH = 0.75;
// Tier 3 — non-gazetted moderate exposure, or gazetted Pearl-facing
const MODERATE = 0.55;
// Tier 2 — gazetted, SE/Sai Kung/Cheung Chau (regular DSD cleanup)
const LOW = 0.3;
// Tier 1 — sheltered embayments or protected Tolo Harbour
const VERY_LOW = 0.15;

const WEIGHTS = {
  // ---- Hotspots (EPD priority / chronic) ----
  "Nim Shue Wan": HOTSPOT,
  "Cheung Sha Lan, Lantau Island": HOTSPOT,
  "Shui Hau Wan": HOTSPOT,
  "Po Chue Tam": HOTSPOT,
  "Fan Lau Beach": HOTSPOT,
  "Yi Long Wan Beach": HOTSPOT,
  "Sham Wan": HOTSPOT,
  "Tai Long Wan": HOTSPOT,
  "Lung Kwu Tan": HOTSPOT,
  "Lung Kwu Sheung Tan": HOTSPOT,
  "Ap Chau": HOTSPOT,
  "Sam Mun Tsai, Tai Po": HOTSPOT,

  // ---- High exposure (non-gazetted, west/SW/NE) ----
  "Castle Peak Beach": HIGH,
  "Sandy Bay": HIGH,
  "Tung Chung Bay": HIGH,
  "Sam Pak Wan, Lantau": HIGH,
  "Pak Shui Wun": HIGH,
  "Lo Tik Wan, Lamma": HIGH,
  "Mo Tat Wan, Lamma": HIGH,
  "Shek Pai Wan, Lamma": HIGH,
  "Sha Ha, Sai Kung": HIGH,
  "Sheung Sze Wan, Sai Kung": HIGH,
  "Chi Ma Wan": HIGH,
  "Little Palm Beach, Sai Kung": HIGH,
  "Pak Sha Wan (Hebe Haven)": HIGH,
  "Lung Ha Wan": HIGH,
  "Yung Shue Au": HIGH,
  "Rocky Bay": HIGH,
  "Hairpin Beach": HIGH,

  // ---- Moderate (mostly non-gazetted south-Lantau / outlying) ----
  "Pui O": MODERATE,
  "Cheung Sha Upper Beach": MODERATE,
  "Cheung Sha Lower Beach": MODERATE,
  "Tong Fuk Beach": MODERATE,
  "Mui Wo Beach": MODERATE,
  "Discovery Bay Tai Pak Beach": MODERATE,
  "Ma Wan Tung Wan Beach": MODERATE,
  "Hoi Ha Beach": MODERATE,
  "Chek Keng Beach": MODERATE,
  "Lung Ha Wan (Hebe Haven)": MODERATE,
  "Peng Chau Tung Wan Beach": MODERATE,
  "Sok Kwu Wan": MODERATE,

  // ---- Gazetted Pearl-River-facing Tuen Mun / Tsuen Wan cluster ----
  "Golden Beach": MODERATE,
  "Butterfly Beach": MODERATE,
  "Cafeteria Old Beach": MODERATE,
  "Cafeteria New Beach": MODERATE,
  "Kadoorie Beach": MODERATE,
  "Anglers' Beach": MODERATE,
  "Gemini Beaches": MODERATE,
  "Casam Beach": MODERATE,
  "Hoi Mei Wan Beach": MODERATE,
  "Lido Beach": MODERATE,
  "Ting Kau Beach": MODERATE,
  "Approach Beach": MODERATE,

  // ---- Gazetted SE / Sai Kung / Cheung Chau / Lamma ----
  "Silverstrand Beach": LOW,
  "Hap Mun Bay Beach": LOW,
  "Kiu Tsui Beach": LOW,
  "Sai Wan Beach": LOW,
  "Long Ke Wan": LOW,
  "Trio Beach": LOW,
  "Italian Beach": LOW,
  "Afternoon Beach": LOW,
  "Tung Wan Beach": LOW,
  "Kwun Yam Wan Beach": LOW,
  "Power Station Beach": LOW,
  "Hung Shing Yeh Beach": LOW,
  "Lo So Shing Beach": LOW,
  "Clear Water Bay First Beach": LOW,
  "Clear Water Bay Second Beach": LOW,
  "Big Wave Bay": LOW,
  "Shek O": LOW,
  "Shek O Main Beach": LOW,
  "Shek O Back Beach": LOW,
  "Stanley Main Beach": LOW,

  // ---- Sheltered gazetted HK Island south ----
  "Repulse Bay": VERY_LOW,
  "Middle Bay": VERY_LOW,
  "South Bay": VERY_LOW,
  "Deep Water Bay": VERY_LOW,
  "St. Stephen's Beach": VERY_LOW,
  "Chung Hom Kok Beach": VERY_LOW,
  "Turtle Cove Beach": VERY_LOW,

  // ---- Protected Tolo Harbour ----
  "Tai Po Lung Mei Beach": VERY_LOW,
  "Lung Mei (Tai Po North)": VERY_LOW,
  "Starfish Bay": VERY_LOW,
  "Wu Kai Sha Pebbles Beach": VERY_LOW,
  "To Tau Wan": VERY_LOW,
  "Tap Mun Beach": VERY_LOW,
};

const DEFAULT_WEIGHT = 0.4;

function patch(file) {
  const full = path.resolve(file);
  const beaches = JSON.parse(fs.readFileSync(full, "utf8"));
  let stamped = 0;
  let defaulted = 0;
  for (const b of beaches) {
    if (Object.prototype.hasOwnProperty.call(WEIGHTS, b.name)) {
      b.historicalWeight = WEIGHTS[b.name];
      stamped++;
    } else {
      b.historicalWeight = DEFAULT_WEIGHT;
      defaulted++;
    }
  }
  fs.writeFileSync(full, JSON.stringify(beaches, null, 2) + "\n");
  console.log(`[${file}] stamped=${stamped}, defaulted=${defaulted}, total=${beaches.length}`);
}

patch("functions/data/beaches.json");
patch("server/data/beaches.json");
