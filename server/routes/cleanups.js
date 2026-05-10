const express = require("express");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const beaches = require("../data/beaches.json");

const router = express.Router();
const beachByName = new Map(beaches.map((b) => [b.name, b]));

// In-memory store for local development
const cleanups = new Map();
let nextId = 1;

// Saved cleanup plans (drafts) per user
const savedPlans = new Map(); // key: plan id
let nextPlanId = 1;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /
router.get("/", optionalAuth, (req, res) => {
  const { beach, region, lat, lng, mine } = req.query;

  let results = [...cleanups.values()].filter((c) => c.status === "active");

  if (mine === "true") {
    if (!req.user) return res.status(401).json({ error: "Auth required" });
    results = results.filter(
      (c) => c.organizerUid === req.user.uid || c.participants.includes(req.user.uid)
    );
  } else {
    results = results.filter((c) => new Date(c.dateTime) >= new Date());
  }

  if (beach) results = results.filter((c) => c.beachName === beach);
  if (region) results = results.filter((c) => c.region === region);

  if (lat && lng) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    results.forEach((c) => {
      c.distance = haversine(userLat, userLng, c.lat, c.lng);
    });
    results.sort((a, b) => a.distance - b.distance);
  } else {
    results.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  }

  res.json({ cleanups: results });
});

// GET /:id
router.get("/:id", (req, res) => {
  const c = cleanups.get(req.params.id);
  if (!c) return res.status(404).json({ error: "Cleanup not found" });
  res.json(c);
});

// POST /
router.post("/", requireAuth, (req, res) => {
  const { beachName, title, titleTc, description, descriptionTc, dateTime, durationMinutes, maxParticipants } = req.body;

  const beach = beachByName.get(beachName);
  if (!beach) return res.status(400).json({ error: "Invalid beach name" });
  if (!title || title.length > 100) return res.status(400).json({ error: "Title required (max 100 chars)" });

  const dt = new Date(dateTime);
  if (isNaN(dt.getTime()) || dt <= new Date()) return res.status(400).json({ error: "dateTime must be a valid future date" });

  const maxP = parseInt(maxParticipants) || 0;
  if (maxP < 0 || maxP > 100) return res.status(400).json({ error: "maxParticipants must be 0-100" });

  const dur = parseInt(durationMinutes) || 120;
  if (![60, 120, 180, 240].includes(dur)) return res.status(400).json({ error: "Invalid duration" });

  const activeCount = [...cleanups.values()].filter(
    (c) => c.organizerUid === req.user.uid && c.status === "active"
  ).length;
  if (activeCount >= 5) return res.status(400).json({ error: "Maximum 5 active cleanups per organizer" });

  const id = String(nextId++);
  const now = new Date().toISOString();
  const cleanup = {
    id,
    beachName: beach.name,
    beachNameTc: beach.nameTc || null,
    region: beach.region,
    lat: beach.lat,
    lng: beach.lng,
    organizerUid: req.user.uid,
    organizerName: req.user.displayName,
    title,
    titleTc: titleTc || null,
    description: description || "",
    descriptionTc: descriptionTc || null,
    dateTime: dt.toISOString(),
    durationMinutes: dur,
    maxParticipants: maxP,
    participants: [req.user.uid],
    participantCount: 1,
    status: "active",
    createdAt: now,
  };

  cleanups.set(id, cleanup);
  res.status(201).json(cleanup);
});

// PUT /:id
router.put("/:id", requireAuth, (req, res) => {
  const c = cleanups.get(req.params.id);
  if (!c) return res.status(404).json({ error: "Cleanup not found" });
  if (c.organizerUid !== req.user.uid) return res.status(403).json({ error: "Only organizer can update" });

  const allowed = ["title", "titleTc", "description", "descriptionTc", "dateTime", "durationMinutes", "maxParticipants"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === "dateTime") {
        const dt = new Date(req.body[key]);
        if (isNaN(dt.getTime()) || dt <= new Date()) return res.status(400).json({ error: "dateTime must be a valid future date" });
        c[key] = dt.toISOString();
      } else if (key === "maxParticipants") {
        const v = parseInt(req.body[key]) || 0;
        if (v < 0 || v > 100) return res.status(400).json({ error: "maxParticipants must be 0-100" });
        c[key] = v;
      } else if (key === "title") {
        if (!req.body[key] || req.body[key].length > 100) return res.status(400).json({ error: "Title required (max 100 chars)" });
        c[key] = req.body[key];
      } else {
        c[key] = req.body[key];
      }
    }
  }
  res.json(c);
});

// DELETE /:id
router.delete("/:id", requireAuth, (req, res) => {
  const c = cleanups.get(req.params.id);
  if (!c) return res.status(404).json({ error: "Cleanup not found" });
  if (c.organizerUid !== req.user.uid) return res.status(403).json({ error: "Only organizer can cancel" });
  c.status = "cancelled";
  res.json({ success: true });
});

// POST /:id/leave
router.post("/:id/leave", requireAuth, (req, res) => {
  const c = cleanups.get(req.params.id);
  if (!c) return res.status(404).json({ error: "Cleanup not found" });
  if (c.organizerUid === req.user.uid) return res.status(400).json({ error: "Organizer cannot leave" });
  const idx = c.participants.indexOf(req.user.uid);
  if (idx === -1) return res.status(400).json({ error: "Not a participant" });
  c.participants.splice(idx, 1);
  c.participantCount--;
  res.json(c);
});

// ---------- Saved cleanup plans (drafts) ----------

// GET /saved — list current user's saved plans
router.get("/saved/list", requireAuth, (req, res) => {
  const mine = [...savedPlans.values()]
    .filter((p) => p.userUid === req.user.uid)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ plans: mine });
});

// POST /saved — create a saved plan
router.post("/saved/list", requireAuth, (req, res) => {
  const { name, plan } = req.body;
  if (!name || typeof name !== "string" || name.length > 80) {
    return res.status(400).json({ error: "Plan name required (max 80 chars)" });
  }
  if (!plan || typeof plan !== "object") {
    return res.status(400).json({ error: "Plan data required" });
  }
  const id = `p${nextPlanId++}`;
  const now = new Date().toISOString();
  const saved = {
    id,
    userUid: req.user.uid,
    name,
    plan,
    createdAt: now,
    updatedAt: now,
  };
  savedPlans.set(id, saved);
  res.status(201).json(saved);
});

// PUT /saved/:id — rename or update
router.put("/saved/list/:id", requireAuth, (req, res) => {
  const p = savedPlans.get(req.params.id);
  if (!p) return res.status(404).json({ error: "Plan not found" });
  if (p.userUid !== req.user.uid) return res.status(403).json({ error: "Forbidden" });
  const { name, plan } = req.body;
  if (name !== undefined) {
    if (!name || name.length > 80) return res.status(400).json({ error: "Invalid name" });
    p.name = name;
  }
  if (plan !== undefined) p.plan = plan;
  p.updatedAt = new Date().toISOString();
  res.json(p);
});

// DELETE /saved/:id
router.delete("/saved/list/:id", requireAuth, (req, res) => {
  const p = savedPlans.get(req.params.id);
  if (!p) return res.status(404).json({ error: "Plan not found" });
  if (p.userUid !== req.user.uid) return res.status(403).json({ error: "Forbidden" });
  savedPlans.delete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
