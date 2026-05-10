const HANDSON_URL =
  "https://volunteer.handsonhongkong.org/search/GetOpportunitiesSearchResultBlockGrid";
const HANDSON_REFERER =
  "https://volunteer.handsonhongkong.org/environment?layoutViewMode=tablet";

const CACHE_TTL_MS = 60 * 60 * 1000;

let cache = { events: null, fetchedAt: null };

function buildBody(currentRows) {
  const params = new URLSearchParams();
  params.set("blockId", "1673");
  params.set("parentBlockId", "76160");
  params.set("currentRows", String(currentRows));
  params.set("isSearch", "true");
  params.set("parameters[distance]", "Any");
  params.set("parameters[issue-areas][]", "Environmental Conservation");
  params.set("parameters[solrQuery]", "");
  return params.toString();
}

async function fetchOnePage(currentRows) {
  const res = await fetch(HANDSON_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0",
      Referer: HANDSON_REFERER,
    },
    body: buildBody(currentRows),
  });
  if (!res.ok) throw new Error(`HandsOn fetch failed: ${res.status}`);
  return res.json();
}

async function fetchEvents() {
  const all = [];
  let total = Infinity;
  let cursor = 0;
  while (cursor < total) {
    const page = await fetchOnePage(cursor);
    total = typeof page.total === "number" ? page.total : 0;
    const days = page.opportunities || [];
    let pageCount = 0;
    for (const day of days) {
      for (const opp of day.ListingOpportunities || []) {
        all.push({ ...opp, _dayDate: day.DateOccurrences });
        pageCount++;
      }
    }
    if (pageCount === 0) break;
    cursor += pageCount;
    if (cursor >= total) break;
  }
  cache = { events: all, fetchedAt: new Date().toISOString() };
  return cache;
}

async function getCachedEvents() {
  if (cache.events) {
    const age = Date.now() - new Date(cache.fetchedAt).getTime();
    if (age < CACHE_TTL_MS) return cache;
  }
  return fetchEvents();
}

module.exports = { getCachedEvents };
