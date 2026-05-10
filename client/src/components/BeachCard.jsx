import { useLang } from "../LangContext";
import { T } from "../i18n";

const RISK_STYLES = {
  "Very High": { bar: "bg-[#b06060]", badge: "bg-[#b06060]" },
  High:        { bar: "bg-[#c89090]", badge: "bg-[#c89090]" },
  Moderate:    { bar: "bg-[#c0a040]", badge: "bg-[#c0a040]" },
  Low:         { bar: "bg-[#5e9e70]", badge: "bg-[#5e9e70]" },
};

// Difficulty 1 (easy) → green, 5 (expert) → deep red. Mirrors RISK_STYLES palette.
const ACCESS_COLORS = {
  1: "text-[#5e9e70]",
  2: "text-[#8cac58]",
  3: "text-[#c0a040]",
  4: "text-[#c89090]",
  5: "text-[#b06060]",
};

export default function BeachCard({ prediction, rank, events = [], sourceUrl, onSelect }) {
  const { lang } = useLang();
  const t = T[lang];
  const {
    beach, nameTc, region, score, riskLevel, accessDifficulty, hikeMinutes, boatOnly,
    topFactors = [], recentStormBoost = false,
  } = prediction;
  const beachName = lang === "tc" && nameTc ? nameTc : beach;
  const style = RISK_STYLES[riskLevel] || RISK_STYLES.Low;
  const barPct = (score * 100).toFixed(0);
  const index = (score * 10).toFixed(1);

  const upcoming = events.filter((e) => e.upcoming);
  const past = events.filter((e) => !e.upcoming);

  return (
    <div className="bg-white overflow-hidden rounded-xl shadow-sm flex">
      {/* Left risk accent strip */}
      <div className={`w-1.5 shrink-0 ${style.bar}`} />

      <div className="flex-1 min-w-0">
        {/* Main content row — clickable to open detail */}
        <button
          type="button"
          onClick={() => onSelect?.(prediction)}
          className="w-full text-left flex items-center gap-3 px-3 py-3 hover:bg-[#f5fbfa] transition-colors focus:outline-none focus:bg-[#f5fbfa]"
          aria-label={`Open details for ${beachName}`}
        >
        {/* Score thumbnail */}
        <div className="shrink-0 w-12 h-12 flex items-center justify-center">
          <span className="text-lg font-bold leading-none text-black">{index}</span>
        </div>

        {/* Beach info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-black truncate">{beachName}</p>
          <p className="text-xs text-[#8ab5af] truncate">
            {region ? (t.regions[region] || region) : ""}
          </p>
          {accessDifficulty != null && (
            <p
              className="text-xs truncate mt-0.5"
              title={t.access.hints[accessDifficulty]}
            >
              <span className={`font-medium ${ACCESS_COLORS[accessDifficulty] || "text-[#145e6a]"}`}>
                {t.access.levels[accessDifficulty]}
              </span>
              <span className="text-[#8ab5af]"> · {"●".repeat(accessDifficulty)}{"○".repeat(5 - accessDifficulty)}</span>
            </p>
          )}
          {hikeMinutes != null && (
            <p className="text-xs text-[#8b6f3a] truncate mt-0.5">
              {t.hikeBadge(hikeMinutes)}
            </p>
          )}
          {boatOnly && (
            <p className="text-xs text-[#2c6f80] truncate mt-0.5">{t.boatBadge}</p>
          )}
          {(riskLevel === "Very High" || riskLevel === "High") &&
            (topFactors.length > 0 || recentStormBoost) && (
            <p className="text-xs text-[#5a7a82] truncate mt-0.5">
              <span className="text-[#8ab5af]">{t.why.label} · </span>
              {[
                ...topFactors.map((k) => t.why[k]).filter(Boolean),
                recentStormBoost ? t.why.stormBoost : null,
              ].filter(Boolean).join(" + ")}
            </p>
          )}
        </div>

        {/* Risk badge + rank */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span
            className={`${style.badge} text-white text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap`}
          >
            {t.risk[riskLevel] || riskLevel}
          </span>
          <span className="text-xs text-[#8ab5af] font-medium">#{rank}</span>
        </div>
        </button>

      {/* Events */}
      {events.length > 0 && (
        <div className="px-3 py-3 border-t border-gray-100 space-y-1">
          {upcoming.map((e, i) => (
            <EventRow key={i} event={e} lang={lang} sourceUrl={sourceUrl} upcoming />
          ))}
          {past.map((e, i) => (
            <EventRow key={i} event={e} lang={lang} sourceUrl={sourceUrl} upcoming={false} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function EventRow({ event, lang, sourceUrl, upcoming }) {
  const dateStr = new Date(event.date).toLocaleDateString(
    lang === "tc" ? "zh-HK" : "en-HK",
    { month: "short", day: "numeric" }
  );
  const title = event.title[lang] || event.title.en;

  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <span className={`shrink-0 font-medium ${upcoming ? "text-[#5e9e70]" : "text-[#8ab5af]"}`}>
        {dateStr}
      </span>
      <span className="text-black truncate">{title}</span>
      <a
        href={event.link || sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-[#145e6a] hover:underline ml-auto"
      >
        ↗
      </a>
    </div>
  );
}
