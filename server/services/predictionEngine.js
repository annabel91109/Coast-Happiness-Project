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

function compassToDegrees(compass) {
  return COMPASS_TO_DEGREES[compass] ?? null;
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

function predict(windStations, marineData) {
  const stationMap = new Map();
  for (const s of windStations) {
    stationMap.set(s.station, s);
  }

  const maxSpeed = Math.max(
    ...windStations.map((s) => s.speed ?? 0),
    1
  );

  const results = beaches.map((beach) => {
    const relevantStations = beach.nearestStations
      .map((name) => stationMap.get(name))
      .filter(Boolean);

    if (relevantStations.length === 0) {
      return {
        beach: beach.name,
        nameTc: beach.nameTc || null,
        region: beach.region,
        gazetted: beach.gazetted ?? false,
        isBeach: beach.isBeach ?? true,
        lat: beach.lat,
        lng: beach.lng,
        score: 0,
        riskLevel: "Low",
        riverScore: Math.round(calcRiverScore(beach) * 100) / 100,
        windInfo: null,
        waveInfo: marineData ? { height: marineData.waveHeight, direction: marineData.waveDirection, period: marineData.wavePeriod } : null,
      };
    }

    // Average across nearby stations
    let totalOnshore = 0;
    let totalSpeedFactor = 0;
    let totalGustBonus = 0;
    let stationCount = 0;

    for (const station of relevantStations) {
      const windDeg = compassToDegrees(station.direction);
      if (windDeg === null || station.speed === null) continue;

      const onshore = calcOnshoreScore(windDeg, beach.orientation);
      const speedFactor = station.speed / maxSpeed;
      const gustBonus =
        station.gust !== null ? ((station.gust - station.speed) / maxSpeed) * 0.15 : 0;

      totalOnshore += onshore;
      totalSpeedFactor += speedFactor;
      totalGustBonus += gustBonus;
      stationCount++;
    }

    if (stationCount === 0) {
      return {
        beach: beach.name,
        nameTc: beach.nameTc || null,
        region: beach.region,
        gazetted: beach.gazetted ?? false,
        isBeach: beach.isBeach ?? true,
        lat: beach.lat,
        lng: beach.lng,
        score: 0,
        riskLevel: "Low",
        riverScore: Math.round(calcRiverScore(beach) * 100) / 100,
        windInfo: null,
        waveInfo: marineData ? { height: marineData.waveHeight, direction: marineData.waveDirection, period: marineData.wavePeriod } : null,
      };
    }

    const avgOnshore = totalOnshore / stationCount;
    const avgSpeedFactor = totalSpeedFactor / stationCount;
    const avgGustBonus = totalGustBonus / stationCount;

    // Wave component (Open-Meteo Marine)
    let waveScore = 0;
    if (marineData?.waveHeight != null && marineData?.waveDirection != null) {
      const waveOnshore = calcOnshoreScore(marineData.waveDirection, beach.orientation);
      const waveHeightFactor = Math.min(marineData.waveHeight / 3, 1); // 3m = max
      waveScore = waveOnshore * waveHeightFactor;
    }

    // Blend: wind 60% + wave 20% + river proximity 20%, with bay trapping multiplier
    const windScore = avgOnshore * avgSpeedFactor + avgGustBonus;
    const riverScore = calcRiverScore(beach);
    const bayMultiplier = 1 + (beach.bayFactor ?? 0) * 0.3;
    const raw = (windScore * 0.60 + waveScore * 0.20 + riverScore * 0.20) * bayMultiplier * beach.exposure;
    const score = Math.min(1, Math.max(0, raw));

    return {
      beach: beach.name,
      nameTc: beach.nameTc || null,
      region: beach.region,
      gazetted: beach.gazetted ?? false,
      isBeach: beach.isBeach ?? true,
      lat: beach.lat,
      lng: beach.lng,
      score: Math.round(score * 100) / 100,
      riskLevel: getRiskLevel(score),
      riverScore: Math.round(riverScore * 100) / 100,
      windInfo: relevantStations.map((s) => ({
        station: s.station,
        direction: s.direction,
        speed: s.speed,
        gust: s.gust,
      })),
      waveInfo: marineData ? { height: marineData.waveHeight, direction: marineData.waveDirection, period: marineData.wavePeriod } : null,
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
        beachTotals.set(p.beach, { sum: 0, count: 0, lat: p.lat, lng: p.lng, region: p.region, gazetted: p.gazetted, isBeach: p.isBeach ?? true, nameTc: p.nameTc || null });
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
      isBeach: totals.isBeach,
      lat: totals.lat,
      lng: totals.lng,
      score: avgScore,
      riskLevel: getRiskLevel(avgScore),
      riverScore: latest ? latest.riverScore : null,
      windInfo: latest ? latest.windInfo : null,
      waveInfo: latest ? latest.waveInfo : null,
      snapshotCount: totals.count,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

module.exports = { predict, predictHistorical, compassToDegrees, calcOnshoreScore, getRiskLevel };
