import { useState } from "react";
import { useLang } from "../LangContext";
import { T } from "../i18n";
import { authFetch } from "../utils/authFetch";

export default function CleanupCard({ cleanup, userId, onUpdate, onSelect, isEpd }) {
  const { lang } = useLang();
  const t = T[lang];
  const ct = t.cleanup;
  const [loading, setLoading] = useState(false);

  const beachName = lang === "tc" && cleanup.beachNameTc ? cleanup.beachNameTc : cleanup.beachName;
  const eventTitle = lang === "tc" && cleanup.titleTc ? cleanup.titleTc : cleanup.title;
  const desc = lang === "tc" && cleanup.descriptionTc ? cleanup.descriptionTc : cleanup.description;
  const region = t.regions[cleanup.region] || cleanup.region;

  const isOrganizer = userId && cleanup.organizerUid === userId;
  const isParticipant = userId && cleanup.participants?.includes(userId);
  // HandsOn occurrences carry their own time range; show date only on the
  // card and surface the start/end window separately so the user sees a
  // clear "13:50 – 17:15" rather than relying on the parsed start time.
  const dateStr = new Date(cleanup.dateTime).toLocaleDateString(
    lang === "tc" ? "zh-HK" : "en-HK",
    isEpd
      ? { weekday: "short", month: "short", day: "numeric" }
      : { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
  );

  async function handleLeave() {
    setLoading(true);
    try {
      const updated = await authFetch("POST", `/api/cleanups/${cleanup.id}/leave`);
      if (onUpdate) onUpdate(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  // External (HandsOn HK) event card
  if (isEpd) {
    const loc = lang === "tc" && cleanup.locationTc ? cleanup.locationTc : cleanup.locationEn;
    const district = lang === "tc" && cleanup.regionTc ? cleanup.regionTc : cleanup.region;
    const card = (
      <div className="bg-white overflow-hidden rounded-xl shadow-sm flex hover:shadow-md transition-shadow">
        <div className="w-1.5 shrink-0 bg-[#5e9e70]" />
        <div className="flex-1 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-black">{eventTitle}</p>
              <p className="text-xs text-[#8ab5af] mt-0.5">
                {dateStr}
                {cleanup.timeRange ? ` · ${cleanup.timeRange}` : ""}
              </p>
              {loc && <p className="text-xs text-[#145e6a] mt-0.5">📍 {loc}</p>}
              {district && district !== loc && (
                <p className="text-xs text-[#8ab5af]">{district}</p>
              )}
              {cleanup.organizer && (
                <p className="text-xs text-[#8ab5af] mt-0.5">{ct.organizer}: {cleanup.organizer}</p>
              )}
              {typeof cleanup.spotsAvailable === "number" && cleanup.spotsAvailable > 0 && (
                <p className="text-xs text-[#8ab5af] mt-0.5">
                  {cleanup.spotsAvailable} {ct.spotsLeft}
                </p>
              )}
              {cleanup.link && (
                <p className="text-xs text-[#145e6a] underline mt-1">{ct.signUp} ↗</p>
              )}
            </div>
            <span className="shrink-0 bg-[#5e9e70] text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {ct.official}
            </span>
          </div>
        </div>
      </div>
    );
    return cleanup.link ? (
      <a href={cleanup.link} target="_blank" rel="noreferrer" className="block">
        {card}
      </a>
    ) : card;
  }

  return (
    <div className="bg-white overflow-hidden rounded-xl shadow-sm flex">
      {/* Accent strip */}
      <div className="w-1.5 shrink-0 bg-[#5a9daa]" />
      <div className="flex-1 min-w-0 px-3 py-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-black truncate">{eventTitle}</p>
            <p className="text-xs text-[#8ab5af]">{dateStr}</p>
            <p className="text-xs text-[#8ab5af]">{beachName} · {region}</p>
          </div>
          <span className="shrink-0 bg-[#5a9daa] text-white text-xs font-medium px-2 py-0.5 rounded-full">
            {ct.community}
          </span>
        </div>

        {/* Description (truncated) */}
        {desc && (
          <p className="text-xs text-[#145e6a] mt-2 line-clamp-2">{desc}</p>
        )}

        {/* Footer: participants + action */}
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-[#8ab5af]">
            <span>{ct.organizer}: {cleanup.organizerName}</span>
            <span className="mx-1.5">·</span>
            <span>
              {cleanup.participantCount}
              {cleanup.maxParticipants > 0 ? `/${cleanup.maxParticipants}` : ""}{" "}
              {ct.participants}
            </span>
          </div>

          <div className="flex gap-2">
            {onSelect && (
              <button
                onClick={() => onSelect(cleanup)}
                className="text-xs text-[#145e6a] hover:underline"
              >
                {ct.viewDetails}
              </button>
            )}
            {userId && !isEpd && (
              isOrganizer ? (
                <span className="text-xs font-medium text-[#5a9daa] px-2 py-1">{ct.hosting}</span>
              ) : isParticipant ? (
                <button
                  onClick={handleLeave}
                  disabled={loading}
                  className="text-xs font-medium px-3 py-1 rounded-lg border border-[#8ab5af] text-[#145e6a] hover:bg-[#e0f3f8] transition-colors disabled:opacity-50"
                >
                  {ct.leave}
                </button>
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
