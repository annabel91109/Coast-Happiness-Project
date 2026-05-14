const express = require("express");
const path = require("path");
const { getCachedEvents } = require("../services/eventsFetcher");

const router = express.Router();

const beaches = require(path.join(__dirname, "../data/beaches.json"));

// Generate every plausible search key for a beach. HandsOn titles don't
// quote the canonical beach name verbatim — "Help at a Beach Cleanup at
// Ma Wan" refers to "Ma Wan Tung Wan Beach", "Cheung Sha Lan (children
// under 13)" matches "Cheung Sha Lan, Lantau Island". So for each beach
// we emit several candidate substrings and match the longest one that
// occurs in the text — longer = more specific.
// English qualifier words that prefix a shared geographic name —
// stripping them lets "Lower Cheung Sha Beach" still match a HandsOn
// title that just writes "Cheung Sha Lan".
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
  // Also emit a qualifier-stripped variant so "Lower Cheung Sha" → "Cheung Sha".
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
// Longest first so a substring of a longer beach name doesn't win over a
// more specific match.
beachMatchers.sort((a, b) => b.key.length - a.key.length);

function matchBeachInText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const m of beachMatchers) {
    if (lower.includes(m.key)) return m.name;
  }
  return null;
}

// Parse "16/5/26 13:50" (D/M/YY HH:mm, Hong Kong local) into an ISO string.
// HandsOn returns this format with single-digit day/month and a 2-digit year.
// _dayDate is "2026-05-06T00:00:00" and is more reliable for the date part,
// so we combine it with the time portion.
function parseEventDateTime(opp) {
  const dayIso = opp._dayDate;
  if (!dayIso) return null;
  const day = dayIso.slice(0, 10);
  const timeMatch = String(opp.DateOccurrence || "").match(/(\d{1,2}):(\d{2})\s*$/);
  const hh = timeMatch ? timeMatch[1].padStart(2, "0") : "09";
  const mm = timeMatch ? timeMatch[2] : "00";
  // Asia/Hong_Kong is UTC+8 year-round.
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
    // Waitlist still counts as a way to participate.
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

router.get("/", (req, res) => {
  const { events, fetchedAt } = getCachedEvents();
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
});

module.exports = router;
