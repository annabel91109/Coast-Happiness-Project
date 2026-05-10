const express = require("express");
const path = require("path");
const windRoutes = require("./routes/wind");
const predictionRoutes = require("./routes/predictions");
const eventsRoutes = require("./routes/events");
const cleanupRoutes = require("./routes/cleanups");
const { startPolling } = require("./services/windFetcher");
const { startPolling: startEventsPolling } = require("./services/eventsFetcher");
const { startPolling: startMarinePolling } = require("./services/marineFetcher");
const windHistory = require("./services/windHistory");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/wind", windRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/cleanups", cleanupRoutes);

// Serve built frontend
const distPath = path.join(__dirname, "../client/dist");
app.use(express.static(distPath));
app.use((req, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  windHistory.load();
  startPolling();
  startEventsPolling();
  startMarinePolling();
});
