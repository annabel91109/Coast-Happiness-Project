const express = require("express");
const { getWindData } = require("../services/windFetcher");
const { getMarineData } = require("../services/marineFetcher");
const { predict, predictHistorical } = require("../services/predictionEngine");
const windHistory = require("../services/windHistory");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { period, from, to } = req.query;

    // Custom date range
    if (from && to) {
      const fromMs = new Date(from).getTime();
      const toMs = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1;
      if (isNaN(fromMs) || isNaN(toMs)) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      const snapshots = await windHistory.getSnapshotsByRange(fromMs, toMs);
      const marine = await getMarineData().catch(() => null);
      if (snapshots.length === 0) {
        const wind = await getWindData();
        if (!wind) return res.status(503).json({ error: "Wind data not yet available" });
        const predictions = predict(wind.stations, marine);
        return res.json({ predictions, snapshotCount: 0, generatedAt: new Date().toISOString() });
      }
      const predictions = predictHistorical(snapshots, marine);
      const dayCount = new Set(snapshots.map((s) => new Date(s.timestamp).toISOString().slice(0, 10))).size;
      return res.json({
        predictions,
        snapshotCount: dayCount,
        oldestSnapshot: new Date(snapshots[0].timestamp).toISOString(),
        newestSnapshot: new Date(snapshots[snapshots.length - 1].timestamp).toISOString(),
        generatedAt: new Date().toISOString(),
      });
    }

    // Historical period requested
    if (period) {
      const validPeriods = windHistory.getValidPeriods();
      if (!validPeriods.includes(period)) {
        return res.status(400).json({ error: `Invalid period. Valid: ${validPeriods.join(", ")}` });
      }

      const snapshots = await windHistory.getSnapshots(period);
      const marine = await getMarineData().catch(() => null);

      if (snapshots.length === 0) {
        const wind = await getWindData();
        if (!wind) return res.status(503).json({ error: "Wind data not yet available" });
        const predictions = predict(wind.stations, marine);
        return res.json({
          predictions,
          period,
          snapshotCount: 1,
          oldestSnapshot: wind.fetchedAt,
          newestSnapshot: wind.fetchedAt,
          generatedAt: new Date().toISOString(),
        });
      }

      const predictions = predictHistorical(snapshots, marine);
      const dayCount = new Set(snapshots.map((s) => new Date(s.timestamp).toISOString().slice(0, 10))).size;
      // For 24h/48h, cap at the period's actual day span to avoid calendar-boundary inflation
      const periodDayCap = { "24h": 1, "48h": 2 };
      const reportedDays = periodDayCap[period] ? Math.min(dayCount, periodDayCap[period]) : dayCount;
      return res.json({
        predictions,
        period,
        snapshotCount: reportedDays,
        oldestSnapshot: new Date(snapshots[0].timestamp).toISOString(),
        newestSnapshot: new Date(snapshots[snapshots.length - 1].timestamp).toISOString(),
        generatedAt: new Date().toISOString(),
      });
    }

    // Default: current/live predictions, with the past 72h of wind folded
    // in via decay-weighted vector averaging. Captures post-storm trash
    // accumulation that the latest hour alone misses.
    const [wind, marine] = await Promise.all([
      getWindData(),
      getMarineData().catch(() => null),
    ]);
    if (!wind) return res.status(503).json({ error: "Wind data not yet available" });

    const now = Date.now();
    const recentSnapshots = await windHistory.getSnapshotsByRange(now - 72 * 60 * 60 * 1000, now);
    const predictions = predict(wind.stations, marine, { recentSnapshots, now });
    res.json({
      predictions,
      windDataFetchedAt: wind.fetchedAt,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/predictions] Error:", err.message);
    res.status(502).json({ error: "Failed to generate predictions" });
  }
});

module.exports = router;
