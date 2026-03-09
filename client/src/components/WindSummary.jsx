import { useLang } from "../LangContext";
import { T } from "../i18n";

export default function WindSummary({ windData }) {
  const { lang } = useLang();
  const t = T[lang];

  if (!windData) return null;

  const { stations, fetchedAt, ageSeconds } = windData;
  const avgSpeed =
    stations.reduce((sum, s) => sum + (s.speed ?? 0), 0) / stations.length;
  const maxGust = Math.max(...stations.map((s) => s.gust ?? 0));

  const directions = stations
    .map((s) => s.direction)
    .filter((d) => d !== "Calm");
  const mostCommon = mode(directions);

  return (
    <div className="bg-white rounded-xl shadow p-5 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        {t.currentWind}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <Stat label={t.dominantDir} value={mostCommon || t.calm || "Calm"} />
        <Stat label={t.avgSpeed} value={`${avgSpeed.toFixed(0)} km/h`} />
        <Stat label={t.maxGust} value={`${maxGust} km/h`} />
        <Stat label={t.stations} value={stations.length} />
      </div>
      <p className="text-xs text-gray-400 mt-3 text-right">
        {t.updatedAgo(ageSeconds)} &middot;{" "}
        {new Date(fetchedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function mode(arr) {
  const counts = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  let max = 0;
  let result = null;
  for (const [k, c] of Object.entries(counts)) {
    if (c > max) {
      max = c;
      result = k;
    }
  }
  return result;
}
