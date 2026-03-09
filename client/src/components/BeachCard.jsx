import { useLang } from "../LangContext";
import { T } from "../i18n";

const RISK_STYLES = {
  "Very High": { bar: "bg-[#b06060]", badge: "bg-[#b06060]" },
  High:        { bar: "bg-[#c89090]", badge: "bg-[#c89090]" },
  Moderate:    { bar: "bg-[#c0a040]", badge: "bg-[#c0a040]" },
  Low:         { bar: "bg-[#5e9e70]", badge: "bg-[#5e9e70]" },
};

export default function BeachCard({ prediction, rank, events = [], epdUrl }) {
  const { lang } = useLang();
  const t = T[lang];
  const { beach, nameTc, region, score, riskLevel, windInfo, waveInfo } = prediction;
  const beachName = lang === "tc" && nameTc ? nameTc : beach;
  const style = RISK_STYLES[riskLevel] || RISK_STYLES.Low;
  const barPct = (score * 100).toFixed(0);
  const index = (score * 10).toFixed(1);

  const upcoming = events.filter((e) => e.upcoming);
  const past = events.filter((e) => !e.upcoming);

  return (
    <div className="bg-[#8ab5af] overflow-hidden rounded-xl shadow-sm">
      {/* Risk score progress bar */}
      <div className="relative h-1 bg-[#e0f3f8]">
        <div
          className={`absolute left-0 top-0 h-full ${style.bar} transition-all`}
          style={{ width: `${barPct}%` }}
        />
      </div>

      {/* Main content row */}
      <div className="flex items-center gap-3 bg-white px-3 py-3">
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
          {windInfo && windInfo.length > 0 && (
            <p className="text-xs text-[#8ab5af] truncate mt-0.5">
              {windInfo.map((w) => {
                const station = (lang === "tc" && t.windStations?.[w.station]) || w.station;
                const dir = (lang === "tc" && t.windDirs?.[w.direction]) || w.direction;
                return `${station}: ${dir} ${w.speed}`;
              }).join(" · ")}
            </p>
          )}
          {waveInfo?.height != null && (
            <p className="text-xs text-[#8ab5af] truncate mt-0.5">
              {t.wave}: {waveInfo.height.toFixed(1)}m{waveInfo.period != null ? ` · ${waveInfo.period.toFixed(0)}s` : ""}
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
      </div>

      {/* Events */}
      {events.length > 0 && (
        <div className="px-3 py-3 bg-white border-t border-[#8ab5af] space-y-1">
          {upcoming.map((e, i) => (
            <EventRow key={i} event={e} lang={lang} epdUrl={epdUrl} upcoming />
          ))}
          {past.map((e, i) => (
            <EventRow key={i} event={e} lang={lang} epdUrl={epdUrl} upcoming={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ event, lang, epdUrl, upcoming }) {
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
        href={event.link || epdUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-[#145e6a] hover:underline ml-auto"
      >
        ↗
      </a>
    </div>
  );
}
