// Helpers for building and exporting cleanup plans.
import logistics from "../data/beachLogistics.json";
import recyclingPoints from "../data/recyclingPoints.json";

// Broad-region keys (as used by HostCleanupForm and BeachList) → precise
// `b.region` values stored on each beach. Without this expansion,
// `regions.includes(b.region)` filters by "NT" / "Islands" / "New Territories",
// none of which match the precise names ("Sai Kung", "Lantau", …).
const REGION_GROUPS = {
  "HK Island": ["HK Island"],
  Kowloon: [],
  NT: ["Sai Kung", "Sha Tin", "Tsuen Wan", "Tuen Mun", "Tai Po", "North"],
  Islands: ["Lantau", "Lamma", "Cheung Chau", "Peng Chau"],
  "New Territories": ["Sai Kung", "Sha Tin", "Tsuen Wan", "Tuen Mun", "Tai Po", "North"],
  "Outlying Islands": ["Lantau", "Lamma", "Cheung Chau", "Peng Chau"],
};

function expandRegions(regions) {
  if (!regions || regions.length === 0) return null;
  const expanded = new Set();
  for (const r of regions) {
    if (REGION_GROUPS[r]) {
      for (const x of REGION_GROUPS[r]) expanded.add(x);
    } else {
      expanded.add(r);
    }
  }
  return expanded;
}

// Find the N closest GREEN@COMMUNITY recycling stations to a beach.
// Returns plain {name, address, materials, district, distanceKm} entries
// already resolved to the requested language so downstream exports
// (.ics / .doc / Google Calendar) inherit the language at build time.
export function nearestRecyclingPoints(lat, lng, n = 3, lang = "en") {
  if (lat == null || lng == null) return [];
  const pickField = (v) => (v == null ? "" : (typeof v === "string" ? v : v[lang] || v.en));
  return recyclingPoints
    .map((p) => ({ ...p, distanceKm: haversine(lat, lng, p.lat, p.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, n)
    .map((p) => ({
      id: p.id,
      name: pickField(p.name),
      address: pickField(p.address),
      district: pickField(p.district),
      materials: pickField(p.materials),
      lat: p.lat,
      lng: p.lng,
      distanceKm: Math.round(p.distanceKm * 10) / 10,
    }));
}

// Haversine distance in km
export function haversine(lat1, lng1, lat2, lng2) {
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

// Suggest top N beaches based on user preferences + predictions.
// `excludeBeachNames` is a Set of canonical beach names that already have
// an upcoming HandsOn HK cleanup — we drop them so users don't book a
// duplicate event on the same shoreline.
export function suggestBeaches(beaches, prefs, n = 3) {
  if (!beaches || beaches.length === 0) return [];

  const {
    regions = [],
    userLat,
    userLng,
    includeGazetted = false,
    diffMin = 1,
    diffMax = 5,
    excludeBeachNames = null,
  } = prefs;

  // Dedupe by beach name
  const uniq = [...new Map(beaches.map((b) => [b.beach, b])).values()];

  const allowed = expandRegions(regions);

  const inDiff = (b) =>
    b.accessDifficulty == null ||
    (b.accessDifficulty >= diffMin && b.accessDifficulty <= diffMax);

  const isExcluded = (b) =>
    excludeBeachNames && excludeBeachNames.has(b.beach || b.name);

  let filtered = uniq.filter((b) => {
    if (!includeGazetted && b.gazetted === true) return false;
    if (allowed && !allowed.has(b.region)) return false;
    if (!inDiff(b)) return false;
    if (isExcluded(b)) return false;
    return true;
  });

  // Fall back: drop the gazetted gate but keep region + difficulty + dedup
  if (filtered.length === 0) {
    filtered = uniq.filter(
      (b) => (!allowed || allowed.has(b.region)) && inDiff(b) && !isExcluded(b)
    );
  }

  const scored = filtered.map((b) => {
    const trashScore = typeof b.score === "number"
      ? b.score
      : typeof b.trashScore === "number"
        ? b.trashScore
        : typeof b.predictedTrash === "number"
          ? b.predictedTrash
          : 0;
    let dist = 0;
    if (userLat != null && userLng != null && b.lat != null && b.lng != null) {
      dist = haversine(userLat, userLng, b.lat, b.lng);
    }
    // Higher trash = better target; closer = better
    const score = trashScore * 0.7 - dist * 0.3;
    return { ...b, _trash: trashScore, _distKm: dist, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, n);
}

// Tolerate both the legacy plain-string shape and the new {en,tc} shape
// so a half-migrated logistics file doesn't break the planner.
function pick(value, lang) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.en || "";
}

// Build a full plan for a chosen beach. `lang` resolves the bilingual
// strings in beachLogistics.json down to plain text — the plan object
// is then language-frozen, so .ics/.doc/Google Calendar exports inherit
// whatever language the user authored it in.
export function buildPlan({ beach, dateTime, durationMinutes, groupSize, transportModes, transportMode, title, description, lang = "en" }) {
  const region = beach.region;
  const regionData = logistics.regions[region] || logistics.regions["NT"];
  const gazetted = beach.gazetted === true;

  // Support both legacy single mode and new multi-mode array
  const modes = Array.isArray(transportModes) && transportModes.length > 0
    ? transportModes
    : transportMode
      ? [transportMode]
      : ["mtr"];

  const labels = lang === "tc"
    ? { mtr: "港鐵 + 步行", bus: "巴士", ferry: "渡輪", car: "自駕" }
    : { mtr: "MTR + walk", bus: "Bus", ferry: "Ferry", car: "Car" };
  const instructions = modes
    .map((m) => `${labels[m] || m}: ${pick(regionData.transport[m], lang)}`)
    .join("\n");

  const transport = {
    preferredModes: modes,
    instructions,
    allOptions: Object.fromEntries(
      Object.entries(regionData.transport).map(([k, v]) => [k, pick(v, lang)])
    ),
  };

  // Scale checklist by group size
  const checklist = logistics.baseChecklist.map((c) => ({
    item: pick(c.item, lang),
    qty: c.perPerson
      ? `${groupSize} × (${c.qty || (lang === "tc" ? "每人 1" : "1 per person")})`
      : c.qty || (lang === "tc" ? "每組 1" : "1 per group"),
  }));

  const rawSafety = gazetted ? logistics.safetyNotes.gazetted : logistics.safetyNotes.nonGazetted;
  const safetyNotes = rawSafety.map((n) => pick(n, lang));

  // Nearest 3 GREEN@COMMUNITY stations by haversine — replaces the old
  // 4-region fallback list (which was the same handful for every beach
  // in a region, including ones in the wrong direction). When the beach
  // has no coordinates we fall back to the legacy region list.
  const recycling = (beach.lat != null && beach.lng != null)
    ? nearestRecyclingPoints(beach.lat, beach.lng, 3, lang)
    : regionData.recycling.map((r) => ({
        name: pick(r.name, lang),
        address: pick(r.address, lang),
        materials: pick(r.materials, lang),
      }));

  const defaultTitle = lang === "tc"
    ? `${beach.beach || beach.name} 清潔活動`
    : `Cleanup at ${beach.beach || beach.name}`;

  return {
    beach: {
      name: beach.beach || beach.name,
      nameTc: beach.nameTc || null,
      region,
      gazetted,
      lat: beach.lat,
      lng: beach.lng,
    },
    dateTime,
    durationMinutes,
    groupSize,
    title: title || defaultTitle,
    description: description || "",
    transport,
    recycling,
    checklist,
    safetyNotes,
    createdAt: new Date().toISOString(),
  };
}

// ---------- Exports ----------

// Build Google Calendar "add event" URL (no OAuth needed)
export function googleCalendarUrl(plan) {
  const start = new Date(plan.dateTime);
  const end = new Date(start.getTime() + plan.durationMinutes * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const details = [
    plan.description,
    "",
    `Beach: ${plan.beach.name} (${plan.beach.region})`,
    `Group size: ${plan.groupSize}`,
    `Transport: ${plan.transport.instructions}`,
    "",
    "Checklist:",
    ...plan.checklist.map((c) => `- ${c.item} (${c.qty})`),
    "",
    "Safety notes:",
    ...plan.safetyNotes.map((s) => `- ${s}`),
    "",
    "Nearest recycling drop-offs:",
    ...plan.recycling.map((r) =>
      `- ${r.name}${r.distanceKm != null ? ` (~${r.distanceKm} km)` : ""}: ${r.address}`
    ),
  ].join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: plan.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
    location: `${plan.beach.name}, Hong Kong`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Build a downloadable .ics file (Apple/Outlook calendar)
export function icsContent(plan) {
  const start = new Date(plan.dateTime);
  const end = new Date(start.getTime() + plan.durationMinutes * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s) => String(s).replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const summary = esc(plan.title);
  const description = esc([
    plan.description,
    `Transport: ${plan.transport.instructions}`,
    `Checklist: ${plan.checklist.map((c) => c.item).join(", ")}`,
  ].join("\n"));
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CoastHappiness//Cleanup//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@coasthappiness`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${esc(plan.beach.name)}, Hong Kong`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// HTML for sharing — also works as a .doc (Word opens HTML)
export function planHtml(plan) {
  const fmtDate = new Date(plan.dateTime).toLocaleString();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${plan.title}</title>
<style>
body{font-family:-apple-system,Arial,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#0d3d47;line-height:1.5;}
h1{color:#145e6a;border-bottom:2px solid #8ab5af;padding-bottom:8px;}
h2{color:#145e6a;margin-top:24px;}
.meta{background:#f0f7f6;padding:12px;border-radius:8px;margin:12px 0;}
ul{padding-left:20px;}
.warn{background:#fff7e6;border-left:4px solid #f39c12;padding:8px 12px;margin:8px 0;}
</style></head><body>
<h1>${plan.title}</h1>
<div class="meta">
<strong>Beach:</strong> ${plan.beach.name} (${plan.beach.region})${plan.beach.gazetted ? " — gazetted" : " — non-gazetted"}<br>
<strong>Date & time:</strong> ${fmtDate}<br>
<strong>Duration:</strong> ${plan.durationMinutes} minutes<br>
<strong>Group size:</strong> ${plan.groupSize}
</div>
${plan.description ? `<p>${plan.description}</p>` : ""}
<h2>Getting there</h2>
<p>${plan.transport.instructions}</p>
<h2>Equipment checklist</h2>
<ul>${plan.checklist.map((c) => `<li>${c.item} — <em>${c.qty}</em></li>`).join("")}</ul>
<p style="background:#f0f7f6;padding:8px 12px;border-radius:6px;font-size:13px;">Need gear? Green Power lends pickers, gloves, scales and bags free of charge — <a href="https://www.greenpower.org.hk/nature-rescue-clean-up-materials-lending-service">Green Power Nature Rescue lending service</a>.</p>
<h2>Nearest recycling drop-offs</h2>
<ul>${plan.recycling.map((r) =>
  `<li><strong>${r.name}</strong>${r.distanceKm != null ? ` <span style="color:#5a7d80;">— ${r.distanceKm} km away</span>` : ""}<br>${r.address} <em>(${r.materials})</em></li>`
).join("")}</ul>
<h2>Safety notes</h2>
${plan.safetyNotes.map((s) => `<div class="warn">${s}</div>`).join("")}
<hr><p style="color:#888;font-size:12px;">Generated by Coast Happiness — ${new Date().toLocaleDateString()}</p>
</body></html>`;
}

// Trigger browser print dialog (user saves as PDF)
export function printPlan(plan) {
  const html = planHtml(plan);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

export function downloadDoc(plan) {
  downloadBlob(planHtml(plan), `${plan.title.replace(/[^\w-]+/g, "_")}.doc`, "application/msword");
}

export function downloadIcs(plan) {
  downloadBlob(icsContent(plan), `${plan.title.replace(/[^\w-]+/g, "_")}.ics`, "text/calendar");
}
