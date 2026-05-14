import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import { useLang } from "../LangContext";
import { T } from "../i18n";

const RISK_COLORS = {
  "Very High": "#b06060",
  High: "#c89090",
  Moderate: "#c0a040",
  Low: "#5e9e70",
};

const ACCESS_COLORS = {
  1: "text-[#5e9e70]",
  2: "text-[#8cac58]",
  3: "text-[#c0a040]",
  4: "text-[#c89090]",
  5: "text-[#b06060]",
};

export default function BeachDetail({ prediction, onClose }) {
  const { lang } = useLang();
  const t = T[lang];
  const mapRef = useRef(null);

  // Lock body scroll while modal is open + close on Escape
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!prediction) return null;

  const { beach, nameTc, region, lat, lng, riskLevel, score, accessDifficulty, hikeMinutes, boatOnly, gazetted } =
    prediction;
  const beachName = lang === "tc" && nameTc ? nameTc : beach;
  const altName = lang === "tc" ? beach : nameTc;
  const color = RISK_COLORS[riskLevel] || RISK_COLORS.Low;
  const index = (score * 10).toFixed(1);

  // Pure name search — let Google Maps find the beach by its English
  // name (TC name if the user is in Chinese), narrowed with "Hong Kong"
  // so generic names like "Sai Wan" don't drift to other regions.
  const searchName = (lang === "tc" && nameTc) ? nameTc : beach;
  const directionsUrl =
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchName + " Hong Kong")}`;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="beach-detail-title"
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-2">
          <div className="flex-1 min-w-0">
            <h2
              id="beach-detail-title"
              className="text-base font-semibold text-[#0d3d47] truncate"
            >
              {beachName}
            </h2>
            <p className="text-xs text-[#5a7d80] truncate">
              {altName ? `${altName} · ` : ""}
              {t.regions[region] || region}
              {gazetted ? ` · ${t.gazettedFilter.gazetted}` : ` · ${t.gazettedFilter["non-gazetted"]}`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close || "Close"}
            className="shrink-0 text-[#145e6a] hover:bg-[#e0f3f8] rounded-full w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {/* Mini map */}
          <div className="rounded-xl overflow-hidden border border-[#e0ecec]">
            <MapContainer
              center={[lat, lng]}
              zoom={14}
              scrollWheelZoom={false}
              style={{ width: "100%", height: 220 }}
              ref={mapRef}
              whenReady={() => {
                // Modal animates in, so the container has no size when Leaflet
                // measures it — recompute once the layout has settled.
                requestAnimationFrame(() => mapRef.current?.invalidateSize());
              }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={19}
              />
              <CircleMarker
                center={[lat, lng]}
                radius={9}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: color,
                  fillOpacity: 0.95,
                  weight: 2,
                }}
              />
            </MapContainer>
          </div>

          {/* Quick stats row */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className="px-2 py-1 rounded-full text-white font-medium"
              style={{ backgroundColor: color }}
            >
              {t.risk[riskLevel] || riskLevel} · {index}
            </span>
            {accessDifficulty != null && (
              <span
                className={`px-2 py-1 rounded-full bg-[#f0f7f6] font-medium ${
                  ACCESS_COLORS[accessDifficulty] || "text-[#145e6a]"
                }`}
                title={t.access.hints[accessDifficulty]}
              >
                {t.access.levels[accessDifficulty]} · {"●".repeat(accessDifficulty)}
                {"○".repeat(5 - accessDifficulty)}
              </span>
            )}
          </div>

          {/* Open in Google Maps — uses the beach's named place (pin,
              photos, reviews) instead of a raw coordinate. */}
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs px-3 py-2 bg-[#145e6a] text-white rounded-lg hover:bg-[#0e4a54] transition-colors"
          >
            🧭 {t.beachDetail.openInMaps}
          </a>

          {/* Boat-only callout — overrides transport notes since road/trail don't apply */}
          {boatOnly && (
            <div className="flex items-start gap-2 bg-[#e6f1f6] border border-[#a8c9d6] rounded-lg px-3 py-2">
              <span className="text-base leading-none">⛴️</span>
              <div className="text-xs text-[#0d3d47]">
                <div className="font-semibold text-[#2c6f80]">{t.beachDetail.boatOnlyTitle}</div>
                <div className="mt-0.5 text-[#5a7d80]">{t.beachDetail.boatOnlyHint}</div>
              </div>
            </div>
          )}

          {/* Hike callout — only for genuine hikes (≥30 min). Shorter
              walks (Rocky Bay, Nim Shue Wan, etc.) are reachable from
              the road and overstating them as "Hike required" misleads
              users. The card still shows the honest minute count badge. */}
          {hikeMinutes != null && hikeMinutes >= 30 && (
            <div className="flex items-start gap-2 bg-[#fbf3e3] border border-[#e6d39a] rounded-lg px-3 py-2">
              <span className="text-base leading-none">🥾</span>
              <div className="text-xs text-[#0d3d47] flex-1 min-w-0">
                <div className="font-semibold text-[#8b6f3a]">
                  {t.beachDetail.hikeRequired} · {hikeMinutes} {t.minutes}
                </div>
                <div className="mt-0.5 text-[#5a7d80]">
                  {t.beachDetail.hikeOneWay(hikeMinutes)}
                </div>
                {/* Route lookup. We don't ship per-beach hiking URLs because
                    HK trail pages move around (AFCD, oasistrek, blogs) and
                    a stale link is worse than none. A targeted search lands
                    users on the freshest write-up for their specific beach. */}
                <a
                  href={`https://www.google.com/${
                    lang === "tc" ? "search?hl=zh-HK&q=" : "search?q="
                  }${encodeURIComponent(
                    (lang === "tc" && nameTc ? nameTc : beach) +
                      (lang === "tc" ? " 香港 行山 路線" : " Hong Kong hike route trail")
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1.5 text-[#8b6f3a] underline hover:text-[#6d562d]"
                >
                  🔗 {t.beachDetail.findRoute}
                </a>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
