const express = require("express");
const { getWindData } = require("../services/windFetcher");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const wind = await getWindData();
    if (!wind) {
      return res.status(503).json({ error: "Wind data not yet available" });
    }
    res.json(wind);
  } catch (err) {
    console.error("[/api/wind] Error:", err.message);
    res.status(502).json({ error: "Failed to fetch wind data from HKO" });
  }
});

module.exports = router;
