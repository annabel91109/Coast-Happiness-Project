import { useState } from "react";
import { useLang } from "../LangContext";
import { T } from "../i18n";
import BeachCard from "./BeachCard";

const REGIONS = ["All", "HK Island", "Lantau", "Lamma", "Cheung Chau", "Sai Kung", "Sha Tin", "Tsuen Wan", "Tuen Mun", "Tai Po", "North", "Peng Chau"];
const GAZETTED_FILTERS = ["all", "gazetted", "non-gazetted"];

export default function BeachList({ predictions, events = [], epdUrl }) {
  const [activeRegion, setActiveRegion] = useState("All");
  const [gazettedFilter, setGazettedFilter] = useState("all");
  const { lang } = useLang();
  const t = T[lang];

  if (!predictions || predictions.length === 0) {
    return <p className="text-[#145e6a] text-center py-8">{t.noData}</p>;
  }

  const byRegion = activeRegion === "All"
    ? predictions
    : predictions.filter((p) => p.region === activeRegion);

  const filtered = gazettedFilter === "gazetted"
    ? byRegion.filter((p) => p.gazetted)
    : gazettedFilter === "non-gazetted"
    ? byRegion.filter((p) => !p.gazetted)
    : byRegion;

  return (
    <div>
      {/* Filter controls — grouped in a card */}
      <div className="mb-4">
        {/* Gazetted toggle */}
        <div className="flex rounded-lg overflow-hidden border border-[#8ab5af] text-xs mb-2 w-fit">
          {GAZETTED_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setGazettedFilter(f)}
              className={`px-3 py-1.5 transition-colors ${
                gazettedFilter === f
                  ? "bg-[#145e6a] text-white"
                  : "bg-white text-[#145e6a] hover:bg-[#e0f3f8]"
              }`}
            >
              {t.gazettedFilter[f]}
            </button>
          ))}
        </div>

        {/* Region chips */}
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setActiveRegion(r)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeRegion === r
                  ? "bg-[#145e6a] text-white border-[#145e6a]"
                  : "bg-white text-[#145e6a] border-[#8ab5af] hover:bg-[#e0f3f8]"
              }`}
            >
              {t.regions[r] || r}
              {r !== "All" && (
                <span className="ml-1 opacity-60">
                  ({predictions.filter((p) => p.region === r).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((p, i) => (
          <BeachCard
            key={p.beach}
            prediction={p}
            rank={i + 1}
            events={events.filter((e) => e.matchedBeach === p.beach)}
            epdUrl={epdUrl}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-[#8ab5af] text-center py-6 text-sm">{t.noBeaches}</p>
      )}
    </div>
  );
}
