const express = require("express");
const path = require("path");
const { getCachedEvents } = require("../services/eventsFetcher");

const router = express.Router();

const beaches = require(path.join(__dirname, "../data/beaches.json"));

function buildBeachKeys(name) {
  const stripped = name
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*,.*$/, "")
    .trim();
  const noSuffix = stripped.replace(/\s+(Beach|Bay)\b/gi, "").trim();

  const keys = new Set([stripped, noSuffix]);
  const tokens = noSuffix.split(/\s+/).filter(Boolean);
  for (let i = 2; i <= tokens.length; i++) {
    keys.add(tokens.slice(0, i).join(" "));
  }
  return [...keys]
    .map((k) => k.toLowerCase())
    .filter((k) => k.length >= 4);
}

const beachMatchers = beaches.flatMap((b) =>
  buildBeachKeys(b.name).map((key) => ({ name: b.name, key }))
);
beachMatchers.sort((a, b) => b.key.length - a.key.length);

function matchBeachInText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const m of beachMatchers) {
    if (lower.includes(m.key)) return m.name;
  }
  return null;
}

function parseEventDateTime(opp) {
  const dayIso = opp._dayDate;
  if (!dayIso) return null;
  const day = dayIso.slice(0, 10);
  const timeMatch = String(opp.DateOccurrence || "").match(/(\d{1,2}):(\d{2})\s*$/);
  const hh = timeMatch ? timeMatch[1].padStart(2, "0") : "09";
  const mm = timeMatch ? timeMatch[2] : "00";
  return `${day}T${hh}:${mm}:00+08:00`;
}

function districtFromLocation(location) {
  if (!location) return "";
  const parts = String(location).split(",").map((s) => s.trim());
  return parts[parts.length - 1] || "";
}

function isJoinable(opp) {
  if (opp.TypeIndicator === "Filled") return false;
  if (typeof opp.SpotsAvailable === "number" && opp.SpotsAvailable <= 0) {
    return Boolean(opp.waitlistEnabled);
  }
  return true;
}

router.get("/", async (req, res) => {
  try {
    const { events, fetchedAt } = await getCachedEvents();
    if (!events) {
      return res.status(503).json({ error: "Events not yet loaded" });
    }

    const refDate = req.query.date ? new Date(req.query.date) : new Date();
    if (isNaN(refDate)) return res.status(400).json({ error: "Invalid date" });

    const formatted = events
      .map((opp) => {
        const dateIso = parseEventDateTime(opp);
        if (!dateIso) return null;
        const matchedBeach =
          matchBeachInText(opp.Title) || matchBeachInText(opp.Location);
        return {
          date: dateIso,
          title: { en: opp.Title || "", tc: null },
          location: { en: opp.Location || "", tc: null },
          district: { en: districtFromLocation(opp.Location), tc: null },
          link: opp.OccurrenceUrl || null,
          organizer: opp.OrganizationName || null,
          spotsAvailable: typeof opp.SpotsAvailable === "number" ? opp.SpotsAvailable : null,
          joinable: isJoinable(opp),
          timeRange: opp.TimeOcurrence || null,
          upcoming: new Date(dateIso) >= refDate,
          matchedBeach,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      refDate: refDate.toISOString().slice(0, 10),
      count: formatted.length,
      fetchedAt,
      sourceUrl: "https://volunteer.handsonhongkong.org/environment",
      events: formatted,
    });
  } catch (err) {
    console.error("[/api/events] Error:", err.message);
    res.status(502).json({ error: "Failed to fetch events" });
  }
});

module.exports = router;
