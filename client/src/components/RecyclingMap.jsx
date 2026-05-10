import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useLang } from "../LangContext";
import { T } from "../i18n";
import recyclingPoints from "../data/recyclingPoints.json";

// All 18 districts get the same green pin — the dataset is uniform
// (GREEN@COMMUNITY Recycling Stations). Distinguish per-site detail in
// the popup, not the marker color.
const PIN_COLOR = "#5e9e70";

export default function RecyclingMap() {
  const { lang } = useLang();
  const t = T[lang];
  const pick = (v) => (v == null ? "" : (typeof v === "string" ? v : v[lang] || v.en));

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-black mb-1">
          {t.recycling.title}
        </h2>
        <p className="text-xs text-[#145e6a]">
          {t.recycling.subtitle}
        </p>
      </div>

      <MapContainer
        center={[22.36, 114.13]}
        zoom={11}
        style={{ height: "65vh", width: "100%" }}
        className="rounded-lg shadow-sm"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        {recyclingPoints.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              fillColor: PIN_COLOR,
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm" style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 600, color: "#0d3d47", marginBottom: 4 }}>
                  ♻️ {pick(p.name)}
                </div>
                <div style={{ color: "#5a7d80", fontSize: 12, marginBottom: 4 }}>
                  {pick(p.district)}
                </div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  {pick(p.address)}
                </div>
                <div style={{ color: "#5a7d80", fontSize: 11 }}>
                  <strong>{t.recycling.accepts}:</strong> {pick(p.materials)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <p className="text-xs text-[#5a7d80] italic">
        {t.recycling.attribution}
      </p>
    </div>
  );
}
