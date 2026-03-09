import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useLang } from "../LangContext";
import { T } from "../i18n";

const RISK_COLORS = {
  "Very High": "#dc2626",
  High: "#f97316",
  Moderate: "#eab308",
  Low: "#22c55e",
};

export default function BeachMap({ predictions }) {
  const { lang } = useLang();
  const t = T[lang];

  return (
    <MapContainer
      center={[22.3, 114.15]}
      zoom={11}
      style={{ height: "500px", width: "100%" }}
      className="rounded-lg shadow-sm"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {predictions.map((p) => {
        const color = RISK_COLORS[p.riskLevel] || RISK_COLORS.Low;
        const radius = 8 + p.score * 16;
        const beachName = lang === "tc" && p.nameTc ? p.nameTc : p.beach;
        const index = (p.score * 10).toFixed(1);
        return (
          <CircleMarker
            key={p.beach}
            center={[p.lat, p.lng]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.6,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{beachName}</strong>
                <div>
                  {t.riskLabel}: <span style={{ color }}>{t.risk[p.riskLevel] || p.riskLevel}</span>
                </div>
                <div>{t.indexShort}: {index}</div>
                {p.windInfo && (
                  <div className="mt-1 text-xs text-gray-500">
                    {p.windInfo.map((w) => {
                      const station = (lang === "tc" && t.windStations?.[w.station]) || w.station;
                      const dir = (lang === "tc" && t.windDirs?.[w.direction]) || w.direction;
                      return (
                        <div key={w.station}>
                          {station}: {dir} {w.speed} {t.kmh}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
