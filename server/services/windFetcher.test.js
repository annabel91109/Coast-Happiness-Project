const { getWindData, getCachedWind, startPolling, stopPolling } = require("./windFetcher");

const SAMPLE_CSV = `Date time,Automatic Weather Station,10-Minute Mean Wind Direction(Compass points),10-Minute Mean Speed(km/hour),10-Minute Maximum Gust(km/hour)
202603021600,Central Pier,Southeast,6,9
202603021600,Cheung Chau Beach,East,12,15
202603021600,Waglan Island,,N/A,N/A
202603021600,Tap Mun,North,22,35`;

afterEach(() => {
  stopPolling();
  jest.restoreAllMocks();
});

describe("parseWindCSV via getWindData", () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(SAMPLE_CSV) })
    );
  });

  test("parses CSV into structured station objects", async () => {
    const result = await getWindData();

    expect(result.stations).toHaveLength(4);
    expect(result.fetchedAt).toBeDefined();
    expect(result.ageSeconds).toBeGreaterThanOrEqual(0);
    expect(result.stale).toBe(false);
  });

  test("parses station fields correctly", async () => {
    const result = await getWindData();
    const central = result.stations[0];

    expect(central).toEqual({
      station: "Central Pier",
      direction: "Southeast",
      speed: 6,
      gust: 9,
      datetime: "202603021600",
    });
  });

  test("handles N/A speed and gust as null", async () => {
    const result = await getWindData();
    const waglan = result.stations[2];

    expect(waglan.station).toBe("Waglan Island");
    expect(waglan.speed).toBeNull();
    expect(waglan.gust).toBeNull();
  });

  test("handles empty direction as Calm", async () => {
    const result = await getWindData();
    const waglan = result.stations[2];

    expect(waglan.direction).toBe("Calm");
  });
});

describe("caching", () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(SAMPLE_CSV) })
    );
  });

  test("serves cached data on second call without re-fetching", async () => {
    jest.resetModules();
    const fresh = require("./windFetcher");

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(SAMPLE_CSV) })
    );

    await fresh.getWindData();
    await fresh.getWindData();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("getCachedWind returns null before any fetch", () => {
    // Reset module to clear cache
    jest.resetModules();
    const fresh = require("./windFetcher");
    expect(fresh.getCachedWind()).toBeNull();
  });
});

describe("error handling", () => {
  test("throws on non-ok HTTP response", async () => {
    // Reset module to clear cache so it actually fetches
    jest.resetModules();
    const fresh = require("./windFetcher");

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500, statusText: "Internal Server Error" })
    );

    await expect(fresh.getWindData()).rejects.toThrow("HKO API returned 500");
  });
});

describe("polling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(SAMPLE_CSV) })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("startPolling triggers an initial fetch", () => {
    startPolling();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("startPolling is idempotent", () => {
    startPolling();
    startPolling();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
