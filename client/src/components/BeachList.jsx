import { useState, useMemo } from "react";
import { useLang } from "../LangContext";
import { T } from "../i18n";
import BeachCard from "./BeachCard";
import BeachDetail from "./BeachDetail";

// Broad region group → precise regions it contains. Kowloon has no
// public bathing beaches at all (the entire peninsula is reclaimed
// waterfront), so it's omitted from the toggle.
const REGION_GROUPS = {
  All: null,
  "HK Island": ["HK Island"],
  "New Territories": ["Sai Kung", "Sha Tin", "Tsuen Wan", "Tuen Mun", "Tai Po", "North"],
  "Outlying Islands": ["Lantau", "Lamma", "Cheung Chau", "Peng Chau"],
};
const GROUPS = Object.keys(REGION_GROUPS);
const GAZETTED_FILTERS = ["all", "gazetted", "non-gazetted"];
const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5];

function precisesForGroup(group) {
  return group === "All" ? null : REGION_GROUPS[group];
}

export default function BeachList({ predictions, events = [], sourceUrl }) {
  const [activeGroup, setActiveGroup] = useState("All");
  const [activeRegion, setActiveRegion] = useState("All");
  const [gazettedFilter, setGazettedFilter] = useState("all");
  const [diffMin, setDiffMin] = useState(1);
  const [diffMax, setDiffMax] = useState(5);
  const [selected, setSelected] = useState(null);
  const { lang } = useLang();
  const t = T[lang];

  const regionCounts = useMemo(() => {
    const counts = {};
    for (const p of predictions) {
      counts[p.region] = (counts[p.region] || 0) + 1;
    }
    return counts;
  }, [predictions]);

  const groupCounts = useMemo(() => {
    const counts = { All: predictions.length };
    for (const group of GROUPS) {
      if (group === "All") continue;
      const list = REGION_GROUPS[group] || [];
      counts[group] = predictions.filter((p) => list.includes(p.region)).length;
    }
    return counts;
  }, [predictions]);

  if (!predictions || predictions.length === 0) {
    return <p className="text-[#145e6a] text-center py-8">{t.noData}</p>;
  }

  const precise = precisesForGroup(activeGroup);
  const visibleRegions = ["All", ...(precise ?? Object.keys(regionCounts))];
  // If the narrow region no longer fits under the current group, fall back to All.
  const effectiveRegion = visibleRegions.includes(activeRegion) ? activeRegion : "All";

  const byGroup = precise === null
    ? predictions
    : predictions.filter((p) => precise.includes(p.region));

  const byRegion = effectiveRegion === "All"
    ? byGroup
    : byGroup.filter((p) => p.region === effectiveRegion);

  const byGazetted = gazettedFilter === "gazetted"
    ? byRegion.filter((p) => p.gazetted)
    : gazettedFilter === "non-gazetted"
    ? byRegion.filter((p) => !p.gazetted)
    : byRegion;

  const filtered = byGazetted.filter((p) => {
    if (p.accessDifficulty == null) return true;
    return p.accessDifficulty >= diffMin && p.accessDifficulty <= diffMax;
  });

  function handleGroupChange(group) {
    setActiveGroup(group);
    const next = precisesForGroup(group);
    if (next && !next.includes(activeRegion)) setActiveRegion("All");
  }

  function handleMinChange(v) {
    const n = Number(v);
    setDiffMin(n);
    if (n > diffMax) setDiffMax(n);
  }
  function handleMaxChange(v) {
    const n = Number(v);
    setDiffMax(n);
    if (n < diffMin) setDiffMin(n);
  }

  return (
    <div>
      <div className="mb-4 space-y-2">
        {/* Broad region group pills */}
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => handleGroupChange(g)}
              aria-pressed={activeGroup === g}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeGroup === g
                  ? "bg-[#145e6a] text-white border-[#145e6a]"
                  : "bg-white text-[#145e6a] border-[#8ab5af] hover:bg-[#e0f3f8]"
              }`}
            >
              {t.regionGroups?.[g] || g}
              {g !== "All" && (
                <span className="ml-1 opacity-60">({groupCounts[g] || 0})</span>
              )}
            </button>
          ))}
        </div>

        {/* Gazetted toggle */}
        <div className="flex rounded-lg overflow-hidden border border-[#8ab5af] text-xs w-fit">
          {GAZETTED_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setGazettedFilter(f)}
              aria-pressed={gazettedFilter === f}
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

        {/* Precise region chips — scoped to the active group */}
        <div className="flex flex-wrap gap-1.5">
          {visibleRegions.map((r) => (
            <button
              key={r}
              onClick={() => setActiveRegion(r)}
              aria-pressed={effectiveRegion === r}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                effectiveRegion === r
                  ? "bg-[#145e6a] text-white border-[#145e6a]"
                  : "bg-white text-[#145e6a] border-[#8ab5af] hover:bg-[#e0f3f8]"
              }`}
            >
              {t.regions[r] || r}
              {r !== "All" && (
                <span className="ml-1 opacity-60">({regionCounts[r] || 0})</span>
              )}
            </button>
          ))}
        </div>

        {/* Difficulty range: two selects for min and max (1..5) */}
        <div className="flex items-center gap-2 text-xs text-[#145e6a] pt-1">
          <span className="font-medium">{t.difficultyFilter.label}:</span>
          <label className="flex items-center gap-1">
            <span className="text-[#8ab5af]">{t.difficultyFilter.min}</span>
            <select
              value={diffMin}
              onChange={(e) => handleMinChange(e.target.value)}
              className="border border-[#8ab5af] rounded px-2 py-1 bg-white text-[#145e6a]"
            >
              {DIFFICULTY_LEVELS.map((n) => (
                <option key={n} value={n}>
                  {n} — {t.access.levels[n]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-[#8ab5af]">{t.difficultyFilter.max}</span>
            <select
              value={diffMax}
              onChange={(e) => handleMaxChange(e.target.value)}
              className="border border-[#8ab5af] rounded px-2 py-1 bg-white text-[#145e6a]"
            >
              {DIFFICULTY_LEVELS.map((n) => (
                <option key={n} value={n}>
                  {n} — {t.access.levels[n]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((p, i) => (
          <BeachCard
            key={p.beach}
            prediction={p}
            rank={i + 1}
            events={events.filter((e) => e.matchedBeach === p.beach)}
            sourceUrl={sourceUrl}
            onSelect={setSelected}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-[#8ab5af] text-center py-6 text-sm">{t.noBeaches}</p>
      )}

      {selected && (
        <BeachDetail prediction={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
