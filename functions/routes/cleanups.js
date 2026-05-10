const express = require("express");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

const beaches = require("../data/beaches.json");
const beachByName = new Map(beaches.map((b) => [b.name, b]));

// Haversine distance in km
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

function cleanupToJson(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    beachName: d.beachName,
    beachNameTc: d.beachNameTc || null,
    region: d.region,
    lat: d.lat,
    lng: d.lng,
    organizerUid: d.organizerUid,
    organizerName: d.organizerName,
    title: d.title,
    titleTc: d.titleTc || null,
    description: d.description || "",
    descriptionTc: d.descriptionTc || null,
    dateTime: d.dateTime?.toDate?.() ? d.dateTime.toDate().toISOString() : d.dateTime,
    durationMinutes: d.durationMinutes,
    maxParticipants: d.maxParticipants,
    participants: d.participants || [],
    participantCount: d.participantCount || 0,
    status: d.status,
    createdAt: d.createdAt?.toDate?.() ? d.createdAt.toDate().toISOString() : d.createdAt,
  };
}

// GET /api/cleanups — list upcoming cleanups
router.get("/", optionalAuth, async (req, res) => {
  try {
    const db = getFirestore("default");
    let query = db.collection("cleanups").where("status", "==", "active");

    const { beach, region, lat, lng, mine } = req.query;

    if (mine === "true") {
      if (!req.user) return res.status(401).json({ error: "Auth required for ?mine=true" });
      // Get cleanups user organized or joined
      const organized = await db.collection("cleanups")
        .where("organizerUid", "==", req.user.uid)
        .get();
      const joined = await db.collection("cleanups")
        .where("participants", "array-contains", req.user.uid)
        .get();

      const seen = new Set();
      const results = [];
      for (const doc of [...organized.docs, ...joined.docs]) {
        if (seen.has(doc.id)) continue;
        if (doc.data().status !== "active") continue;
        seen.add(doc.id);
        results.push(cleanupToJson(doc));
      }
      results.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
      return res.json({ cleanups: results });
    }

    if (beach) {
      query = query.where("beachName", "==", beach);
    }
    if (region) {
      query = query.where("region", "==", region);
    }

    const snap = await query.limit(100).get();
    const nowMs = Date.now();
    let results = snap.docs
      .map(cleanupToJson)
      .filter((c) => c.dateTime && new Date(c.dateTime).getTime() >= nowMs)
      .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

    // Distance sort if lat/lng provided
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      if (!isNaN(userLat) && !isNaN(userLng)) {
        results.forEach((c) => {
          c.distance = haversine(userLat, userLng, c.lat, c.lng);
        });
        results.sort((a, b) => a.distance - b.distance);
      }
    }

    res.json({ cleanups: results });
  } catch (err) {
    console.error("[cleanups] GET / error:", err);
    res.status(500).json({ error: "Failed to load cleanups" });
  }
});

// GET /api/cleanups/:id — single cleanup detail
router.get("/:id", async (req, res) => {
  try {
    const db = getFirestore("default");
    const doc = await db.collection("cleanups").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Cleanup not found" });
    res.json(cleanupToJson(doc));
  } catch (err) {
    console.error("[cleanups] GET /:id error:", err.message);
    res.status(500).json({ error: "Failed to load cleanup" });
  }
});

// POST /api/cleanups — create cleanup
router.post("/", requireAuth, async (req, res) => {
  try {
    const { beachName, title, titleTc, description, descriptionTc, dateTime, durationMinutes, maxParticipants } = req.body;

    // Validate beach
    const beach = beachByName.get(beachName);
    if (!beach) return res.status(400).json({ error: "Invalid beach name" });

    // Validate title
    if (!title || title.length > 100) return res.status(400).json({ error: "Title required (max 100 chars)" });

    // Validate dateTime
    const dt = new Date(dateTime);
    if (isNaN(dt.getTime()) || dt <= new Date()) {
      return res.status(400).json({ error: "dateTime must be a valid future date" });
    }

    // Validate maxParticipants
    const maxP = parseInt(maxParticipants) || 0;
    if (maxP < 0 || maxP > 100) return res.status(400).json({ error: "maxParticipants must be 0-100" });

    // Validate duration
    const dur = parseInt(durationMinutes) || 120;
    if (![60, 120, 180, 240].includes(dur)) return res.status(400).json({ error: "Invalid duration" });

    // Check organizer active cleanup limit
    const db = getFirestore("default");
    const orgSnap = await db.collection("cleanups")
      .where("organizerUid", "==", req.user.uid)
      .get();
    const activeCount = orgSnap.docs.filter((d) => d.data().status === "active").length;
    if (activeCount >= 5) {
      return res.status(400).json({ error: "Maximum 5 active cleanups per organizer" });
    }

    const now = Timestamp.now();
    const docData = {
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
      dateTime: Timestamp.fromDate(dt),
      durationMinutes: dur,
      maxParticipants: maxP,
      participants: [req.user.uid], // organizer auto-joins
      participantCount: 1,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const ref = await db.collection("cleanups").add(docData);
    res.status(201).json({ id: ref.id, ...docData, dateTime: dt.toISOString(), createdAt: now.toDate().toISOString() });
  } catch (err) {
    console.error("[cleanups] POST / error:", err);
    res.status(500).json({ error: "Failed to create cleanup" });
  }
});

// PUT /api/cleanups/:id — update (organizer only)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const db = getFirestore("default");
    const docRef = db.collection("cleanups").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Cleanup not found" });
    if (doc.data().organizerUid !== req.user.uid) {
      return res.status(403).json({ error: "Only the organizer can update this cleanup" });
    }

    const allowed = ["title", "titleTc", "description", "descriptionTc", "dateTime", "durationMinutes", "maxParticipants"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === "dateTime") {
          const dt = new Date(req.body[key]);
          if (isNaN(dt.getTime()) || dt <= new Date()) {
            return res.status(400).json({ error: "dateTime must be a valid future date" });
          }
          updates[key] = Timestamp.fromDate(dt);
        } else if (key === "maxParticipants") {
          const v = parseInt(req.body[key]) || 0;
          if (v < 0 || v > 100) return res.status(400).json({ error: "maxParticipants must be 0-100" });
          updates[key] = v;
        } else if (key === "title") {
          if (!req.body[key] || req.body[key].length > 100) return res.status(400).json({ error: "Title required (max 100 chars)" });
          updates[key] = req.body[key];
        } else {
          updates[key] = req.body[key];
        }
      }
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update" });
    updates.updatedAt = Timestamp.now();
    await docRef.update(updates);

    const updated = await docRef.get();
    res.json(cleanupToJson(updated));
  } catch (err) {
    console.error("[cleanups] PUT /:id error:", err.message);
    res.status(500).json({ error: "Failed to update cleanup" });
  }
});

// DELETE /api/cleanups/:id — cancel (organizer only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const db = getFirestore("default");
    const docRef = db.collection("cleanups").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Cleanup not found" });
    if (doc.data().organizerUid !== req.user.uid) {
      return res.status(403).json({ error: "Only the organizer can cancel this cleanup" });
    }

    await docRef.update({ status: "cancelled", updatedAt: Timestamp.now() });
    res.json({ success: true });
  } catch (err) {
    console.error("[cleanups] DELETE /:id error:", err.message);
    res.status(500).json({ error: "Failed to cancel cleanup" });
  }
});

// POST /api/cleanups/:id/leave — leave a cleanup
router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const db = getFirestore("default");
    const docRef = db.collection("cleanups").doc(req.params.id);

    await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) throw Object.assign(new Error("Cleanup not found"), { status: 404 });

      const data = doc.data();
      if (data.organizerUid === req.user.uid) {
        throw Object.assign(new Error("Organizer cannot leave their own cleanup"), { status: 400 });
      }
      if (!data.participants?.includes(req.user.uid)) {
        throw Object.assign(new Error("Not a participant"), { status: 400 });
      }

      tx.update(docRef, {
        participants: FieldValue.arrayRemove(req.user.uid),
        participantCount: FieldValue.increment(-1),
        updatedAt: Timestamp.now(),
      });
    });

    const updated = await docRef.get();
    res.json(cleanupToJson(updated));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ---------- Saved cleanup plans (drafts) ----------

function savedPlanToJson(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    userUid: d.userUid,
    name: d.name,
    plan: d.plan,
    createdAt: d.createdAt?.toDate?.() ? d.createdAt.toDate().toISOString() : d.createdAt,
    updatedAt: d.updatedAt?.toDate?.() ? d.updatedAt.toDate().toISOString() : d.updatedAt,
  };
}

// GET /api/cleanups/saved/list — list current user's saved plans
router.get("/saved/list", requireAuth, async (req, res) => {
  try {
    const db = getFirestore("default");
    const snap = await db.collection("savedCleanupPlans")
      .where("userUid", "==", req.user.uid)
      .limit(100)
      .get();
    const plans = snap.docs
      .map(savedPlanToJson)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 50);
    res.json({ plans });
  } catch (err) {
    console.error("[cleanups] GET /saved/list error:", err);
    res.status(500).json({ error: "Failed to load saved plans" });
  }
});

// POST /api/cleanups/saved/list — create a saved plan
router.post("/saved/list", requireAuth, async (req, res) => {
  try {
    const { name, plan } = req.body;
    if (!name || typeof name !== "string" || name.length > 80) {
      return res.status(400).json({ error: "Plan name required (max 80 chars)" });
    }
    if (!plan || typeof plan !== "object") {
      return res.status(400).json({ error: "Plan data required" });
    }
    const db = getFirestore("default");
    const now = Timestamp.now();
    const ref = await db.collection("savedCleanupPlans").add({
      userUid: req.user.uid,
      name,
      plan,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ref.get();
    res.status(201).json(savedPlanToJson(doc));
  } catch (err) {
    console.error("[cleanups] POST /saved/list error:", err);
    res.status(500).json({ error: "Failed to save plan" });
  }
});

// PUT /api/cleanups/saved/list/:id — rename or update plan
router.put("/saved/list/:id", requireAuth, async (req, res) => {
  try {
    const db = getFirestore("default");
    const ref = db.collection("savedCleanupPlans").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Plan not found" });
    if (doc.data().userUid !== req.user.uid) return res.status(403).json({ error: "Forbidden" });

    const updates = { updatedAt: Timestamp.now() };
    if (req.body.name !== undefined) {
      if (!req.body.name || req.body.name.length > 80) return res.status(400).json({ error: "Invalid name" });
      updates.name = req.body.name;
    }
    if (req.body.plan !== undefined) updates.plan = req.body.plan;
    await ref.update(updates);
    const updated = await ref.get();
    res.json(savedPlanToJson(updated));
  } catch (err) {
    console.error("[cleanups] PUT /saved/list/:id error:", err.message);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

// DELETE /api/cleanups/saved/list/:id
router.delete("/saved/list/:id", requireAuth, async (req, res) => {
  try {
    const db = getFirestore("default");
    const ref = db.collection("savedCleanupPlans").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Plan not found" });
    if (doc.data().userUid !== req.user.uid) return res.status(403).json({ error: "Forbidden" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    console.error("[cleanups] DELETE /saved/list/:id error:", err.message);
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

module.exports = router;
