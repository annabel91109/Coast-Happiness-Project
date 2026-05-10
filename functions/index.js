const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const express = require("express");
const windRoutes = require("./routes/wind");
const predictionRoutes = require("./routes/predictions");
const eventsRoutes = require("./routes/events");
const cleanupRoutes = require("./routes/cleanups");

initializeApp();
getFirestore("default").settings({ ignoreUndefinedProperties: true });

const app = express();

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).send("");
  next();
});

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/wind", windRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/cleanups", cleanupRoutes);

// Manual trigger to collect a wind snapshot on demand
app.post("/api/collect-wind", async (req, res) => {
  try {
    const { getWindData } = require("./services/windFetcher");
    const windHistory = require("./services/windHistory");
    const wind = await getWindData();
    if (!wind) return res.status(503).json({ error: "Failed to fetch wind data" });
    const entry = await windHistory.append(wind.stations);
    res.json({ ok: true, timestamp: new Date(entry.timestamp).toISOString(), stations: wind.stations.length });
  } catch (err) {
    console.error("[collect-wind] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

exports.api = onRequest({ cors: true }, app);

// Scheduled function: fetch wind data every 6 hours and save to Firestore
exports.collectWind = onSchedule("every 6 hours", async () => {
  const { getWindData } = require("./services/windFetcher");
  const windHistory = require("./services/windHistory");

  const wind = await getWindData();
  if (!wind) {
    console.error("[collectWind] Failed to fetch wind data");
    return;
  }

  await windHistory.append(wind.stations);
  console.log(`[collectWind] Saved snapshot with ${wind.stations.length} stations`);
});
