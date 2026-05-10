const beaches = require("../data/beaches.json");

const COMPASS_TO_DEGREES = {
  North: 0,
  "North Northeast": 22.5,
  Northeast: 45,
  "East Northeast": 67.5,
  East: 90,
  "East Southeast": 112.5,
  Southeast: 135,
  "South Southeast": 157.5,
  South: 180,
  "South Southwest": 202.5,
  Southwest: 225,
  "West Southwest": 247.5,
  West: 270,
  "West Northwest": 292.5,
  Northwest: 315,
  "North Northwest": 337.5,
};

const COMPASS_BY_DEGREES = Object.entries(COMPASS_TO_DEGREES)
  .map(([name, deg]) => ({ name, deg }));

function compassToDegrees(compass) {
  return COMPASS_TO_DEGREES[compass] ?? null;
}

function degreesToCompass(deg) {
  if (deg == null) return null;
  const norm = ((deg % 360) + 360) % 360;
  let best = COMPASS_BY_DEGREES[0];
  let bestDiff = 360;
  for (const c of COMPASS_BY_DEGREES) {
    let diff = Math.abs(norm - c.deg);
    if (diff > 180) diff = 360 - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best.name;
}

function stationDeg(station) {
  if (station.directionDeg != null) return station.directionDeg;
  return compassToDegrees(station.direction);
}

// Difficulty 1-5 derived from three signals: how far the beach is from
// the road network (roadTier), how long the walk-in is (hikeMinutes),
// and how rough the ground is (hikeGrade). Combining them avoids the
// bug where a flat 10-min coastal stroll (Nim Shue Wan) scored the
// same as a 10-min rocky scramble.
//
//   roadTier  road | ferry → 0     kaito → +2     remote → +3
//   hike min  <15 → 0   15-29 → 1   30-59 → 2   60-119 → 3   120+ → 4
//   hikeGrade flat → 0   rolling → +1   steep → +2   scramble → +2
//
// Final = clamp(1, 5, 1 + roadBonus + hikeBase + gradeBonus). A legacy
// hand-set accessDifficulty is honoured only when none of the new
// fields are present (defensive default during the data backfill).
function deriveAccessDifficulty(beach) {
  const hasNewFields =
    beach.roadTier != null ||
    beach.hikeGrade != null ||
    beach.hikeMinutes != null;
  if (!hasNewFields) return beach.accessDifficulty ?? 1;

  const roadBonus =
    beach.roadTier === "remote" ? 3 :
    beach.roadTier === "kaito"  ? 2 : 0;

  const m = beach.hikeMinutes ?? 0;
  const hikeBase =
    m >= 120 ? 4 :
    m >= 60  ? 3 :
    m >= 30  ? 2 :
    m >= 15  ? 1 : 0;

  const gradeBonus =
    beach.hikeGrade === "scramble" ? 2 :
    beach.hikeGrade === "steep"    ? 2 :
    beach.hikeGrade === "rolling"  ? 1 : 0;

  const score = 1 + roadBonus + hikeBase + gradeBonus;
  return Math.max(1, Math.min(5, score));
}

// Key HK river mouths — persistent sources of floating debris
const RIVER_MOUTHS = [
  { name: "Pearl River (Lingdingyang)", lat: 22.20, lng: 113.75, weight: 1.0 },
  { name: "Pearl River (Humen outlet)", lat: 22.45, lng: 113.67, weight: 0.7 },
  { name: "Sham Chun River (Deep Bay)", lat: 22.52, lng: 113.87, weight: 0.5 },
  { name: "Yuen Long Creek (Deep Bay)", lat: 22.46, lng: 114.03, weight: 0.4 },
  { name: "Shing Mun River (Tolo)",     lat: 22.38, lng: 114.19, weight: 0.6 },
  { name: "Lam Tsuen River (Tolo)",     lat: 22.45, lng: 114.16, weight: 0.5 },
];
const RIVER_DECAY_KM = 20; // exponential decay scale

function haversineKm(lat1, lng1, lat2, lng2) {
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

function calcRiverScore(beach) {
  let score = 0;
  for (const river of RIVER_MOUTHS) {
    const km = haversineKm(beach.lat, beach.lng, river.lat, river.lng);
    score += river.weight * Math.exp(-km / RIVER_DECAY_KM);
  }
  return Math.min(1, score);
}

function calcOnshoreScore(windDeg, beachOrientation) {
  // Wind direction is where wind blows FROM.
  // Wind blowing toward a beach means wind comes from the opposite direction of the beach's sea-facing orientation.
  // A south-facing beach (orientation 180) gets onshore wind from the south (180).
  // So direct onshore = windDeg === beachOrientation.
  const diff = Math.abs(windDeg - beachOrientation);
  const angle = diff > 180 ? 360 - diff : diff;
  const score = Math.cos((angle * Math.PI) / 180);
  return Math.max(0, score);
}

function getRiskLevel(score) {
  if (score >= 0.75) return "Very High";
  if (score >= 0.5) return "High";
  if (score >= 0.25) return "Moderate";
  return "Low";
}

// 72-hour decay-weighted wind integration. The current snapshot enters
// at full weight (age = 0), past snapshots are weighted exp(-age/τ) with
// an 18-hour half-life, and anything older than 72h is dropped. Direction
// is averaged as a vector (u, v) so 350°+10° collapses to North, not 180°.
const WIND_HALF_LIFE_MS = 18 * 60 * 60 * 1000;
const WIND_WINDOW_MS = 72 * 60 * 60 * 1000;
const WIND_TAU_MS = WIND_HALF_LIFE_MS / Math.LN2;

function smoothStations(currentStations, recentSnapshots, now) {
  const acc = new Map();
  const upsert = (name, dirDeg, speed, gust, w) => {
    if (dirDeg == null || speed == null || w <= 0) return;
    const rad = (dirDeg * Math.PI) / 180;
    let e = acc.get(name);
    if (!e) {
      e = { sumU: 0, sumV: 0, sumW: 0, gustSum: 0, gustW: 0 };
      acc.set(name, e);
    }
    e.sumU += Math.sin(rad) * speed * w;
    e.sumV += Math.cos(rad) * speed * w;
    e.sumW += w;
    if (gust != null) {
      e.gustSum += gust * w;
      e.gustW += w;
    }
  };

  for (const s of currentStations || []) {
    upsert(s.station, stationDeg(s), s.speed, s.gust, 1);
  }
  for (const snap of recentSnapshots || []) {
    const age = now - snap.timestamp;
    if (age <= 0 || age > WIND_WINDOW_MS) continue;
    const w = Math.exp(-age / WIND_TAU_MS);
    for (const s of snap.stations || []) {
      upsert(s.station, stationDeg(s), s.speed, s.gust, w);
    }
  }

  const result = [];
  for (const [name, e] of acc) {
    if (e.sumW === 0) continue;
    const u = e.sumU / e.sumW;
    const v = e.sumV / e.sumW;
    const speed = Math.sqrt(u * u + v * v);
    const directionDeg = ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360;
    result.push({
      station: name,
      directionDeg,
      direction: degreesToCompass(directionDeg),
      speed: Math.round(speed * 10) / 10,
      gust: e.gustW > 0 ? Math.round((e.gustSum / e.gustW) * 10) / 10 : null,
    });
  }
  return result;
}

// Compute the per-beach wind-debris pressure from a list of station
// readings. Returns the same blended scalar that feeds the dynamic
// score (avgOnshore * speedFactor + gustBonus) so the smoothed and
// instantaneous variants can be compared apples-to-apples.
function beachWindScore(stationList, beachOrientation, maxSpeed) {
  let onshoreSum = 0, speedFactorSum = 0, gustBonusSum = 0, count = 0;
  for (const s of stationList) {
    const dirDeg = stationDeg(s);
    if (dirDeg == null || s.speed == null) continue;
    const onshore = calcOnshoreScore(dirDeg, beachOrientation);
    const speedFactor = s.speed / maxSpeed;
    const gustBonus = s.gust != null ? ((s.gust - s.speed) / maxSpeed) * 0.15 : 0;
    onshoreSum += onshore;
    speedFactorSum += speedFactor;
    gustBonusSum += gustBonus;
    count++;
  }
  if (count === 0) return null;
  return (onshoreSum / count) * (speedFactorSum / count) + (gustBonusSum / count);
}

function emptyResult(beach, marineData) {
  return {
    beach: beach.name,
    nameTc: beach.nameTc || null,
    region: beach.region,
    gazetted: beach.gazetted ?? false,
    accessDifficulty: deriveAccessDifficulty(beach),
    hikeMinutes: beach.hikeMinutes ?? null,
    boatOnly: beach.boatOnly === true,
    isBeach: beach.isBeach ?? true,
    lat: beach.lat,
    lng: beach.lng,
    score: 0,
    riskLevel: "Low",
    riverScore: Math.round(calcRiverScore(beach) * 100) / 100,
    windInfo: null,
    waveInfo: marineData ? { height: marineData.waveHeight, direction: marineData.waveDirection, period: marineData.wavePeriod } : null,
    topFactors: [],
    recentStormBoost: false,
  };
}

// opts.recentSnapshots: decay-weighted wind smoothing source (live mode).
// opts.now: ms timestamp used for smoothing (defaults to Date.now()).
function predict(windStations, marineData, opts = {}) {
  const recentSnapshots = Array.isArray(opts.recentSnapshots) ? opts.recentSnapshots : null;
  const useSmoothing = recentSnapshots && recentSnapshots.length > 0;
  const now = opts.now ?? Date.now();

  const effectiveStations = useSmoothing
    ? smoothStations(windStations, recentSnapshots, now)
    : windStations;

  const stationMap = new Map(effectiveStations.map((s) => [s.station, s]));
  const currentMap = useSmoothing
    ? new Map(windStations.map((s) => [s.station, s]))
    : null;

  const maxSpeed = Math.max(
    ...effectiveStations.map((s) => s.speed ?? 0),
    1
  );

  const results = beaches.map((beach) => {
    const eff = beach.nearestStations.map((n) => stationMap.get(n)).filter(Boolean);
    if (eff.length === 0) return emptyResult(beach, marineData);

    const effWindScore = beachWindScore(eff, beach.orientation, maxSpeed);
    if (effWindScore == null) return emptyResult(beach, marineData);

    let recentStormBoost = false;
    if (useSmoothing) {
      const cur = beach.nearestStations.map((n) => currentMap.get(n)).filter(Boolean);
      const curWindScore = cur.length > 0
        ? beachWindScore(cur, beach.orientation, maxSpeed)
        : null;
      if (
        curWindScore != null &&
        effWindScore > 0.1 &&
        effWindScore > curWindScore * 1.3
      ) {
        recentStormBoost = true;
      }
    }

    let waveScore = 0;
    if (marineData?.waveHeight != null && marineData?.waveDirection != null) {
      const waveOnshore = calcOnshoreScore(marineData.waveDirection, beach.orientation);
      const waveHeightFactor = Math.min(marineData.waveHeight / 3, 1); // 3m = max
      waveScore = waveOnshore * waveHeightFactor;
    }

    const riverScore = calcRiverScore(beach);
    const historical = beach.historicalWeight ?? 0.4;
    const bayMultiplier = 1 + (beach.bayFactor ?? 0) * 0.3;
    // Exposure gates only the wind/wave/river components (those depend on
    // openness to incoming debris flow). The historical prior already encodes
    // accumulation reality, so it bypasses exposure — otherwise semi-enclosed
    // hotspots like Cheung Sha Lan get suppressed by their own shelter.
    const dynamic =
      (effWindScore * 0.45 + waveScore * 0.15 + riverScore * 0.15) * beach.exposure;
    const raw = (dynamic + historical * 0.25) * bayMultiplier;
    const score = Math.min(1, Math.max(0, raw));

    // Top factors: rank each blended component by its actual contribution
    // to the score, so the explainer surfaces what is *driving* this beach
    // today. Bay trapping enters as a pseudo-factor when materially boosting.
    const contributions = [
      { key: "wind",       value: effWindScore * 0.45 * beach.exposure },
      { key: "wave",       value: waveScore * 0.15 * beach.exposure },
      { key: "river",      value: riverScore * 0.15 * beach.exposure },
      { key: "historical", value: historical * 0.25 },
    ];
    if ((beach.bayFactor ?? 0) >= 0.4) {
      contributions.push({ key: "bay", value: (beach.bayFactor ?? 0) * 0.15 });
    }
    contributions.sort((a, b) => b.value - a.value);
    const topFactors = contributions
      .filter((c) => c.value > 0.02)
      .slice(0, 2)
      .map((c) => c.key);

    return {
      beach: beach.name,
      nameTc: beach.nameTc || null,
      region: beach.region,
      gazetted: beach.gazetted ?? false,
      accessDifficulty: deriveAccessDifficulty(beach),
      hikeMinutes: beach.hikeMinutes ?? null,
      boatOnly: beach.boatOnly === true,
      isBeach: beach.isBeach ?? true,
      lat: beach.lat,
      lng: beach.lng,
      placeId: beach.placeId || null,
      score: Math.round(score * 100) / 100,
      riskLevel: getRiskLevel(score),
      riverScore: Math.round(riverScore * 100) / 100,
      windInfo: eff.map((s) => ({
        station: s.station,
        direction: s.direction,
        speed: s.speed,
        gust: s.gust,
      })),
      waveInfo: marineData ? { height: marineData.waveHeight, direction: marineData.waveDirection, period: marineData.wavePeriod } : null,
      topFactors,
      recentStormBoost,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

function predictHistorical(snapshots, marineData) {
  if (snapshots.length === 0) return [];

  // Calculate predictions for each snapshot, then average scores per beach
  const allPredictions = snapshots.map((snap) => predict(snap.stations, marineData));

  // Build average scores keyed by beach name
  const beachTotals = new Map();
  for (const predictions of allPredictions) {
    for (const p of predictions) {
      if (!beachTotals.has(p.beach)) {
        beachTotals.set(p.beach, { sum: 0, count: 0, lat: p.lat, lng: p.lng, region: p.region, gazetted: p.gazetted, accessDifficulty: p.accessDifficulty ?? null, hikeMinutes: p.hikeMinutes ?? null, boatOnly: p.boatOnly === true, isBeach: p.isBeach ?? true, nameTc: p.nameTc || null });
      }
      const entry = beachTotals.get(p.beach);
      entry.sum += p.score;
      entry.count++;
      if (!entry.nameTc && p.nameTc) entry.nameTc = p.nameTc;
    }
  }

  // Use the latest snapshot's windInfo for display
  const latestPredictions = allPredictions[allPredictions.length - 1];
  const latestMap = new Map(latestPredictions.map((p) => [p.beach, p]));

  const results = [];
  for (const [beachName, totals] of beachTotals) {
    const avgScore = Math.round((totals.sum / totals.count) * 100) / 100;
    const latest = latestMap.get(beachName);
    results.push({
      beach: beachName,
      nameTc: totals.nameTc,
      region: totals.region,
      gazetted: totals.gazetted,
      accessDifficulty: totals.accessDifficulty,
      hikeMinutes: totals.hikeMinutes,
      boatOnly: totals.boatOnly === true,
      isBeach: totals.isBeach,
      lat: totals.lat,
      lng: totals.lng,
      score: avgScore,
      riskLevel: getRiskLevel(avgScore),
      riverScore: latest ? latest.riverScore : null,
      windInfo: latest ? latest.windInfo : null,
      waveInfo: latest ? latest.waveInfo : null,
      snapshotCount: totals.count,
      topFactors: latest ? latest.topFactors : [],
      recentStormBoost: false,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

module.exports = {
  predict,
  predictHistorical,
  compassToDegrees,
  degreesToCompass,
  calcOnshoreScore,
  getRiskLevel,
  smoothStations,
};
