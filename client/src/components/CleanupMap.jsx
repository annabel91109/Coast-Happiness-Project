import { useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useLang } from "../LangContext";
import { T } from "../i18n";
import CleanupCard from "./CleanupCard";

export default function CleanupMap({ cleanups, epdEvents, userId, onUpdate, onSelect }) {
  const { lang } = useLang();
  const t = T[lang];
  const ct = t.cleanup;
  const [locating, setLocating] = useState(false);

  // Group community cleanups by beach
  const byBeach = new Map();
  for (const c of cleanups) {
    const key = c.beachName;
    if (!byBeach.has(key)) byBeach.set(key, { lat: c.lat, lng: c.lng, cleanups: [] });
    byBeach.get(key).cleanups.push(c);
  }

  return (
    <div className="relative">
      <MapContainer
        center={[22.3, 114.15]}
        zoom={11}
        style={{ width: "100%" }}
        className="h-[60vh] min-h-[300px] rounded-lg shadow-sm"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {[...byBeach.entries()].map(([beachName, { lat, lng, cleanups: beachCleanups }]) => (
          <CircleMarker
            key={beachName}
            center={[lat, lng]}
            radius={10 + beachCleanups.length * 3}
            pathOptions={{
              color: "#5a9daa",
              fillColor: "#5a9daa",
              fillOpacity: 0.6,
              weight: 2,
            }}
          >
            <Popup maxWidth={280}>
              <div className="space-y-2">
                {beachCleanups.map((c) => {
                  const title = lang === "tc" && c.titleTc ? c.titleTc : c.title;
                  // EPD events publish only a date — drop the time fields
                  // or they render as 08:00 HK (midnight UTC).
                  const dateStr = new Date(c.dateTime).toLocaleDateString(
                    lang === "tc" ? "zh-HK" : "en-HK",
                    c.isEpd
                      ? { month: "short", day: "numeric" }
                      : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
                  );
                  return (
                    <div key={c.id} className="text-sm">
                      <strong>{title}</strong>
                      <div className="text-xs text-gray-500">{dateStr}</div>
                      <div className="text-xs text-gray-500">
                        {c.participantCount}{c.maxParticipants > 0 ? `/${c.maxParticipants}` : ""} {ct.participants}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
