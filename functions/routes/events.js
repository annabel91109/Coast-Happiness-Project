const express = require("express");
const path = require("path");
const { getCachedEvents } = require("../services/eventsFetcher");

const router = express.Router();

const beaches = require(path.join(__dirname, "../data/beaches.json"));

const QUALIFIER_PREFIXES = new Set([
  "lower", "upper", "old", "new", "north", "south", "east", "west",
  "main", "big", "small", "first", "second", "third",
]);

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
  if (tokens.length >= 2 && QUALIFIER_PREFIXES.has(tokens[0].toLowerCase())) {
    const tail = tokens.slice(1);
    keys.add(tail.join(" "));
    for (let i = 2; i < tail.length; i++) {
      keys.add(tail.slice(0, i).join(" "));
    }
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

// HandsOn HK's "environment" category bundles cleanups together with soap
// recycling, secondhand clothing sorts, and reforestation. Only the
// shoreline/trail cleanups belong on our Join a Cleanup list (and feed
// into the host-wizard dedup), so gate on a "clean" / 清潔 / 清理 keyword.
function isCleanupEvent(title) {
  if (!title) return false;
  const en = String(title).toLowerCase();
  if (/\bclean(?:up|ing|-up)?\b/.test(en)) return true;
  if (/清潔|清理/.test(String(title))) return true;
  return false;
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
      .filter((opp) => isCleanupEvent(opp.Title))
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
