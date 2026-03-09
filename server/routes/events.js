const express = require("express");
const path = require("path");
const { getCachedEvents } = require("../services/eventsFetcher");

const router = express.Router();

const beaches = require(path.join(__dirname, "../data/beaches.json"));

function pick(field, idx) {
  if (!field) return "";
  if (Array.isArray(field)) return field[idx] || field[0] || "";
  if (typeof field === "object") return idx === 1 ? (field.tc || field.en || "") : (field.en || "");
  return String(field);
}


// Build exact and normalized lookups
const beachNameSet = new Set(beaches.map((b) => b.name));

function normalizeName(name) {
  return name
    .replace(/\s*\([^)]*\)/g, "")            // strip parentheticals
    .replace(/\s*,.*$/, "")                   // strip comma qualifiers
    .replace(/\s+(Beach|Bay|Wan)\b/gi, "")    // Wan = Bay = Beach
    .trim()
    .toLowerCase();
}

const normalizedMap = new Map(); // normalized → canonical beach name
for (const b of beaches) {
  normalizedMap.set(normalizeName(b.name), b.name);
}

function matchBeachByName(loc) {
  const name = pick(loc, 0);
  if (!name) return null;
  if (beachNameSet.has(name)) return name;
  return normalizedMap.get(normalizeName(name)) ?? null;
}

// GET /api/events?date=YYYY-MM-DD  (defaults to today)
router.get("/", (req, res) => {
  const { events, fetchedAt } = getCachedEvents();

  if (!events) {
    return res.status(503).json({ error: "Events not yet loaded" });
  }

  const refDate = req.query.date ? new Date(req.query.date) : new Date();
  if (isNaN(refDate)) return res.status(400).json({ error: "Invalid date" });

  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const from = refDate.getTime() - ONE_MONTH_MS;
  const to = refDate.getTime() + ONE_MONTH_MS;

  const filtered = events
    .filter((e) => {
      const d = new Date(e.date[0]).getTime();
      return d >= from && d <= to;
    })
    .map((e) => ({
      date: e.date[0],
      title: { en: pick(e.title, 0), tc: pick(e.title, 1) },
      location: { en: pick(e.loc, 0), tc: pick(e.loc, 1) },
      district: { en: pick(e.district, 0), tc: pick(e.district, 1) },
      link: e.link || null,
      upcoming: new Date(e.date[0]) >= refDate,
      matchedBeach: matchBeachByName(e.loc),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  res.json({
    refDate: refDate.toISOString().slice(0, 10),
    count: filtered.length,
    fetchedAt,
    epdUrl: "https://www.epd.gov.hk/epd/clean_shorelines/events.html",
    events: filtered,
  });
});

module.exports = router;
