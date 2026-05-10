// One-shot script: stamp `roadTier` and `hikeGrade` onto every beach.
// Together with the existing `hikeMinutes`, these feed
// deriveAccessDifficulty() in services/predictionEngine.js.
//
//   roadTier  "road"   bus / MTR / car park reaches the beachfront
//             "ferry"  scheduled passenger ferry then a walk
//             "kaito"  small charter / sampan only (boatOnly === true)
//             "remote" no scheduled service — hire boat or very obscure
//
//   hikeGrade "flat"     beach-front, paved path, or near-zero gain
//             "rolling"  family-trail style; some stairs or gentle hill
//             "steep"    sustained climb, exposed steps, country-trail
//             "scramble" off-trail rock work, slippery boulders
//
// Source notes: AFCD HK Trails, Lantau Trail, MacLehose Stage 2,
// Sai Wan Pavilion shuttle route, Lamma Family Trail, plus on-the-
// ground knowledge of the coastal access points.

const fs = require("fs");
const path = require("path");

const PROFILE = {
  // ---- HK Island ----
  "Repulse Bay":             { roadTier: "road",  hikeGrade: "flat" },
  "Middle Bay":              { roadTier: "road",  hikeGrade: "flat" },
  "South Bay":               { roadTier: "road",  hikeGrade: "rolling" },
  "Deep Water Bay":          { roadTier: "road",  hikeGrade: "flat" },
  "Shek O":                  { roadTier: "road",  hikeGrade: "flat" },
  "Big Wave Bay":            { roadTier: "road",  hikeGrade: "rolling" },
  "Rocky Bay":               { roadTier: "road",  hikeGrade: "scramble" },
  "Stanley Main Beach":      { roadTier: "road",  hikeGrade: "flat" },
  "St. Stephen's Beach":     { roadTier: "road",  hikeGrade: "flat" },
  "Chung Hom Kok Beach":     { roadTier: "road",  hikeGrade: "flat" },
  "Turtle Cove Beach":       { roadTier: "road",  hikeGrade: "rolling" },
  "Hairpin Beach":           { roadTier: "road",  hikeGrade: "rolling" },
  "Sandy Bay":               { roadTier: "road",  hikeGrade: "flat" },
  "Shek O Back Beach":       { roadTier: "road",  hikeGrade: "rolling" },
  "Shek O Main Beach":       { roadTier: "road",  hikeGrade: "flat" },

  // ---- Lantau ----
  "Pui O":                          { roadTier: "road",  hikeGrade: "flat" },
  "Cheung Sha Upper Beach":         { roadTier: "road",  hikeGrade: "flat" },
  "Cheung Sha Lower Beach":         { roadTier: "road",  hikeGrade: "flat" },
  "Tong Fuk Beach":                 { roadTier: "road",  hikeGrade: "flat" },
  "Yi Long Wan Beach":              { roadTier: "road",  hikeGrade: "scramble" },
  "Nim Shue Wan":                   { roadTier: "ferry", hikeGrade: "flat" },
  "Mui Wo Beach":                   { roadTier: "ferry", hikeGrade: "flat" },
  "Discovery Bay Tai Pak Beach":    { roadTier: "ferry", hikeGrade: "flat" },
  "Chi Ma Wan":                     { roadTier: "road",  hikeGrade: "steep" },
  "Shui Hau Wan":                   { roadTier: "road",  hikeGrade: "flat" },
  "Fan Lau Beach":                  { roadTier: "road",  hikeGrade: "steep" },
  "Tung Chung Bay":                 { roadTier: "road",  hikeGrade: "flat" },
  "Po Chue Tam":                    { roadTier: "road",  hikeGrade: "rolling" },
  "Cheung Sha Lan, Lantau Island":  { roadTier: "ferry", hikeGrade: "rolling" },
  "Sam Pak Wan, Lantau":            { roadTier: "ferry", hikeGrade: "rolling" },

  // ---- Lamma ----
  "Hung Shing Yeh Beach": { roadTier: "ferry", hikeGrade: "flat" },
  "Lo So Shing Beach":    { roadTier: "ferry", hikeGrade: "rolling" },
  "Sok Kwu Wan":          { roadTier: "ferry", hikeGrade: "flat" },
  "Sham Wan":             { roadTier: "ferry", hikeGrade: "steep" },
  "Power Station Beach":  { roadTier: "ferry", hikeGrade: "rolling" },
  "Shek Pai Wan, Lamma":  { roadTier: "ferry", hikeGrade: "steep" },
  "Mo Tat Wan, Lamma":    { roadTier: "ferry", hikeGrade: "flat" },
  "Lo Tik Wan, Lamma":    { roadTier: "ferry", hikeGrade: "rolling" },

  // ---- Cheung Chau ----
  "Tung Wan Beach":      { roadTier: "ferry", hikeGrade: "flat" },
  "Kwun Yam Wan Beach":  { roadTier: "ferry", hikeGrade: "flat" },
  "Italian Beach":       { roadTier: "ferry", hikeGrade: "rolling" },
  "Afternoon Beach":     { roadTier: "ferry", hikeGrade: "rolling" },

  // ---- Sai Kung ----
  "Trio Beach":                 { roadTier: "kaito", hikeGrade: "flat" },
  "Tai Long Wan":               { roadTier: "road",  hikeGrade: "steep" },
  "Clear Water Bay First Beach":{ roadTier: "road",  hikeGrade: "flat" },
  "Clear Water Bay Second Beach":{ roadTier: "road", hikeGrade: "flat" },
  "Silverstrand Beach":         { roadTier: "road",  hikeGrade: "flat" },
  "Hap Mun Bay Beach":          { roadTier: "kaito", hikeGrade: "flat" },
  "Kiu Tsui Beach":             { roadTier: "kaito", hikeGrade: "flat" },
  "Sai Wan Beach":              { roadTier: "road",  hikeGrade: "steep" },
  "Long Ke Wan":                { roadTier: "road",  hikeGrade: "steep" },
  "Pak Sha Wan (Hebe Haven)":   { roadTier: "road",  hikeGrade: "flat" },
  "Hoi Ha Beach":               { roadTier: "road",  hikeGrade: "flat" },
  "Chek Keng Beach":            { roadTier: "road",  hikeGrade: "steep" },
  "Lung Ha Wan":                { roadTier: "road",  hikeGrade: "steep" },
  "Tap Mun Beach":              { roadTier: "kaito", hikeGrade: "flat" },
  "Sheung Sze Wan, Sai Kung":   { roadTier: "road",  hikeGrade: "flat" },
  "Sha Ha, Sai Kung":           { roadTier: "road",  hikeGrade: "flat" },
  "Pak Shui Wun":               { roadTier: "road",  hikeGrade: "steep" },
  "Little Palm Beach, Sai Kung":{ roadTier: "road",  hikeGrade: "flat" },

  // ---- Tuen Mun ----
  "Golden Beach":          { roadTier: "road", hikeGrade: "flat" },
  "Butterfly Beach":       { roadTier: "road", hikeGrade: "flat" },
  "Cafeteria Old Beach":   { roadTier: "road", hikeGrade: "flat" },
  "Cafeteria New Beach":   { roadTier: "road", hikeGrade: "flat" },
  "Kadoorie Beach":        { roadTier: "road", hikeGrade: "flat" },
  "Castle Peak Beach":     { roadTier: "road", hikeGrade: "flat" },
  "Lung Kwu Tan":          { roadTier: "road", hikeGrade: "flat" },
  "Lung Kwu Sheung Tan":   { roadTier: "road", hikeGrade: "rolling" },

  // ---- Tsuen Wan ----
  "Anglers' Beach":        { roadTier: "road",  hikeGrade: "flat" },
  "Gemini Beaches":        { roadTier: "road",  hikeGrade: "flat" },
  "Casam Beach":           { roadTier: "road",  hikeGrade: "flat" },
  "Hoi Mei Wan Beach":     { roadTier: "road",  hikeGrade: "flat" },
  "Lido Beach":            { roadTier: "road",  hikeGrade: "flat" },
  "Ting Kau Beach":        { roadTier: "road",  hikeGrade: "flat" },
  "Approach Beach":        { roadTier: "road",  hikeGrade: "flat" },
  "Ma Wan Tung Wan Beach": { roadTier: "ferry", hikeGrade: "flat" },

  // ---- Tai Po ----
  "Tai Po Lung Mei Beach": { roadTier: "road", hikeGrade: "flat" },
  "Sam Mun Tsai, Tai Po":  { roadTier: "road", hikeGrade: "flat" },

  // ---- Sha Tin / Ma On Shan ----
  "Starfish Bay":            { roadTier: "road", hikeGrade: "flat" },
  "Wu Kai Sha Pebbles Beach":{ roadTier: "road", hikeGrade: "flat" },
  "To Tau Wan":              { roadTier: "road", hikeGrade: "rolling" },

  // ---- Peng Chau ----
  "Peng Chau Tung Wan Beach": { roadTier: "ferry", hikeGrade: "flat" },

  // ---- North (very remote) ----
  "Ap Chau":      { roadTier: "remote", hikeGrade: "flat" },
  "Yung Shue Au": { roadTier: "remote", hikeGrade: "rolling" },
};

function patch(file) {
  const full = path.resolve(file);
  const beaches = JSON.parse(fs.readFileSync(full, "utf8"));
  let stamped = 0;
  const missing = [];
  for (const b of beaches) {
    const p = PROFILE[b.name];
    if (!p) {
      missing.push(b.name);
      continue;
    }
    b.roadTier = p.roadTier;
    b.hikeGrade = p.hikeGrade;
    stamped++;
  }
  fs.writeFileSync(full, JSON.stringify(beaches, null, 2) + "\n");
  console.log(`[${file}] stamped=${stamped}, total=${beaches.length}`);
  if (missing.length) {
    console.log(`  MISSING profile: ${missing.join(", ")}`);
  }
}

patch("functions/data/beaches.json");
patch("server/data/beaches.json");
