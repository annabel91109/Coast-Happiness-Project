const { predict, compassToDegrees, calcOnshoreScore, getRiskLevel, smoothStations, degreesToCompass } = require("./predictionEngine");
const beaches = require("../data/beaches.json");

describe("compassToDegrees", () => {
  test("converts cardinal directions", () => {
    expect(compassToDegrees("North")).toBe(0);
    expect(compassToDegrees("East")).toBe(90);
    expect(compassToDegrees("South")).toBe(180);
    expect(compassToDegrees("West")).toBe(270);
  });

  test("converts intercardinal directions", () => {
    expect(compassToDegrees("Northeast")).toBe(45);
    expect(compassToDegrees("Southeast")).toBe(135);
  });

  test("returns null for unknown direction", () => {
    expect(compassToDegrees("Calm")).toBeNull();
    expect(compassToDegrees("Variable")).toBeNull();
  });
});

describe("calcOnshoreScore", () => {
  test("direct onshore wind returns 1", () => {
    // South-facing beach (180), wind from south (180) = direct onshore
    expect(calcOnshoreScore(180, 180)).toBeCloseTo(1.0);
  });

  test("direct offshore wind returns 0", () => {
    // South-facing beach (180), wind from north (0) = offshore
    expect(calcOnshoreScore(0, 180)).toBeCloseTo(0);
  });

  test("crosswind (90 degrees off) returns 0", () => {
    // South-facing beach (180), wind from east (90)
    expect(calcOnshoreScore(90, 180)).toBeCloseTo(0);
  });

  test("45-degree onshore returns ~0.707", () => {
    // South-facing beach (180), wind from southeast (135)
    expect(calcOnshoreScore(135, 180)).toBeCloseTo(0.707, 2);
  });

  test("handles wraparound (350 vs 10)", () => {
    // Beach facing north (0), wind from 350 (almost north)
    expect(calcOnshoreScore(350, 0)).toBeGreaterThan(0.9);
  });
});

describe("getRiskLevel", () => {
  test("maps scores to correct levels", () => {
    expect(getRiskLevel(0.8)).toBe("Very High");
    expect(getRiskLevel(0.75)).toBe("Very High");
    expect(getRiskLevel(0.6)).toBe("High");
    expect(getRiskLevel(0.5)).toBe("High");
    expect(getRiskLevel(0.3)).toBe("Moderate");
    expect(getRiskLevel(0.1)).toBe("Low");
    expect(getRiskLevel(0)).toBe("Low");
  });
});

describe("predict", () => {
  const mockStations = [
    { station: "Stanley", direction: "South", speed: 20, gust: 28 },
    { station: "Waglan Island", direction: "South", speed: 22, gust: 30 },
    { station: "Cheung Chau Beach", direction: "South", speed: 18, gust: 24 },
    { station: "Cheung Chau", direction: "South", speed: 16, gust: 22 },
    { station: "Sai Kung", direction: "South", speed: 15, gust: 20 },
    { station: "Tap Mun", direction: "South", speed: 14, gust: 19 },
    { station: "Tuen Mun", direction: "South", speed: 10, gust: 14 },
    { station: "Tseung Kwan O", direction: "South", speed: 12, gust: 16 },
    { station: "Wong Chuk Hang", direction: "South", speed: 11, gust: 15 },
  ];

  test("returns predictions for all beaches", () => {
    const results = predict(mockStations);
    expect(results).toHaveLength(beaches.length);
  });

  test("results are sorted by score descending", () => {
    const results = predict(mockStations);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  test("each prediction has required fields", () => {
    const results = predict(mockStations);
    for (const r of results) {
      expect(r).toHaveProperty("beach");
      expect(r).toHaveProperty("lat");
      expect(r).toHaveProperty("lng");
      expect(r).toHaveProperty("score");
      expect(r).toHaveProperty("riskLevel");
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  test("south-facing beaches score high with southerly wind", () => {
    const results = predict(mockStations);
    const repulse = results.find((r) => r.beach === "Repulse Bay");
    expect(repulse.score).toBeGreaterThan(0.3);
  });

  test("east-facing beaches score lower than south-facing with southerly wind", () => {
    const results = predict(mockStations);
    const bigWave = results.find((r) => r.beach === "Big Wave Bay");
    const repulse = results.find((r) => r.beach === "Repulse Bay");
    // East-facing crosswind should never beat a direct onshore south-facing beach.
    expect(bigWave.score).toBeLessThan(repulse.score);
  });

  test("each prediction includes topFactors", () => {
    const results = predict(mockStations);
    const repulse = results.find((r) => r.beach === "Repulse Bay");
    expect(Array.isArray(repulse.topFactors)).toBe(true);
    expect(repulse.topFactors.length).toBeGreaterThan(0);
    expect(repulse.recentStormBoost).toBe(false);
  });
});

describe("smoothStations", () => {
  test("opposing winds across snapshots cancel via vector averaging", () => {
    // 30 km/h east + 30 km/h west, equal weight, should collapse to ~0 km/h.
    const now = 100_000_000;
    const current = [{ station: "Test", direction: "East", speed: 30, gust: null }];
    const recent = [
      { timestamp: now - 1000, stations: [{ station: "Test", direction: "West", speed: 30, gust: null }] },
    ];
    const smoothed = smoothStations(current, recent, now);
    expect(smoothed).toHaveLength(1);
    expect(smoothed[0].speed).toBeLessThan(1);
  });

  test("older snapshots receive less weight than newer", () => {
    const now = 100_000_000;
    const current = [{ station: "Test", direction: "South", speed: 5, gust: null }];
    // 60h ago: a 50 km/h south wind. Should still bump speed above 5 but not to 50.
    const recent = [
      { timestamp: now - 60 * 60 * 60 * 1000, stations: [{ station: "Test", direction: "South", speed: 50, gust: null }] },
    ];
    const smoothed = smoothStations(current, recent, now);
    expect(smoothed[0].speed).toBeGreaterThan(5);
    expect(smoothed[0].speed).toBeLessThan(20);
  });

  test("snapshots older than 72h are dropped", () => {
    const now = 100_000_000;
    const current = [{ station: "Test", direction: "South", speed: 10, gust: null }];
    const recent = [
      { timestamp: now - 100 * 60 * 60 * 1000, stations: [{ station: "Test", direction: "South", speed: 100, gust: null }] },
    ];
    const smoothed = smoothStations(current, recent, now);
    expect(smoothed[0].speed).toBeCloseTo(10, 0);
  });
});

describe("predict with smoothing", () => {
  const south = [
    { station: "Stanley", direction: "South", speed: 5, gust: null },
    { station: "Wong Chuk Hang", direction: "South", speed: 5, gust: null },
  ];
  const stormSnapshots = [
    {
      timestamp: Date.now() - 6 * 60 * 60 * 1000,
      stations: [
        { station: "Stanley", direction: "South", speed: 40, gust: 55 },
        { station: "Wong Chuk Hang", direction: "South", speed: 40, gust: 55 },
      ],
    },
  ];

  test("recent storm boost flag fires when past wind exceeded current", () => {
    const results = predict(south, null, { recentSnapshots: stormSnapshots });
    const repulse = results.find((r) => r.beach === "Repulse Bay");
    expect(repulse.recentStormBoost).toBe(true);
  });

  test("smoothed prediction beats unsmoothed for the same calm-after-storm scenario", () => {
    const calm = predict(south).find((r) => r.beach === "Repulse Bay");
    const smoothed = predict(south, null, { recentSnapshots: stormSnapshots })
      .find((r) => r.beach === "Repulse Bay");
    expect(smoothed.score).toBeGreaterThan(calm.score);
  });
});

describe("degreesToCompass", () => {
  test("round-trips through compassToDegrees", () => {
    for (const compass of ["North", "East", "South", "West", "Northeast"]) {
      const deg = compassToDegrees(compass);
      expect(degreesToCompass(deg)).toBe(compass);
    }
  });

  test("snaps to nearest 22.5° increment", () => {
    expect(degreesToCompass(0)).toBe("North");
    expect(degreesToCompass(45)).toBe("Northeast");
    expect(degreesToCompass(360)).toBe("North");
    expect(degreesToCompass(-1)).toBe("North");
  });

  test("handles stations with calm/null wind", () => {
    const calmStations = [
      { station: "Stanley", direction: "Calm", speed: null, gust: null },
    ];
    const results = predict(calmStations);
    const stanley = results.find((r) => r.beach === "Stanley Main Beach");
    expect(stanley.score).toBe(0);
  });
});
