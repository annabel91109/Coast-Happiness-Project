import { useState } from "react";
import { useLang } from "../LangContext";
import { T } from "../i18n";
import { authFetch } from "../utils/authFetch";

export default function CleanupDetail({ cleanup, userId, onUpdate, onClose }) {
  const { lang } = useLang();
  const t = T[lang];
  const ct = t.cleanup;
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(cleanup.title);
  const [editDesc, setEditDesc] = useState(cleanup.description);

  const beachName = lang === "tc" && cleanup.beachNameTc ? cleanup.beachNameTc : cleanup.beachName;
  const eventTitle = lang === "tc" && cleanup.titleTc ? cleanup.titleTc : cleanup.title;
  const desc = lang === "tc" && cleanup.descriptionTc ? cleanup.descriptionTc : cleanup.description;
  const region = t.regions[cleanup.region] || cleanup.region;

  const isOrganizer = userId && cleanup.organizerUid === userId;
  const isParticipant = userId && cleanup.participants?.includes(userId);

  // EPD events publish only a date — drop the time fields or they render
  // as 08:00 HK (midnight UTC).
  const dateStr = new Date(cleanup.dateTime).toLocaleDateString(
    lang === "tc" ? "zh-HK" : "en-HK",
    cleanup.isEpd
      ? { weekday: "long", year: "numeric", month: "long", day: "numeric" }
      : { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }
  );

  const durLabel = ct[`dur${cleanup.durationMinutes}`] || `${cleanup.durationMinutes} min`;

  async function handleLeave() {
    setLoading(true);
    try {
      const updated = await authFetch("POST", `/api/cleanups/${cleanup.id}/leave`);
      if (onUpdate) onUpdate(updated);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }

  async function handleCancel() {
    if (!window.confirm(ct.cancelConfirm)) return;
    setLoading(true);
    try {
      await authFetch("DELETE", `/api/cleanups/${cleanup.id}`);
      onClose();
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    setLoading(true);
    try {
      const updated = await authFetch("PUT", `/api/cleanups/${cleanup.id}`, {
        title: editTitle,
        description: editDesc,
      });
      if (onUpdate) onUpdate(updated);
      setEditing(false);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 text-[#8ab5af] hover:text-[#145e6a] text-lg">✕</button>

        {/* Badge */}
        <span className="inline-block bg-[#5a9daa] text-white text-xs font-medium px-2 py-0.5 rounded-full mb-3">
          {ct.community}
        </span>

        {/* Title */}
        {editing ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full border border-[#8ab5af] rounded-lg px-3 py-2 text-sm mb-3"
          />
        ) : (
          <h2 className="text-lg font-semibold text-[#0d3d47] mb-1">{eventTitle}</h2>
        )}

        {/* Info */}
        <div className="space-y-1 text-sm text-[#145e6a] mb-4">
          <p>{beachName} · {region}</p>
          <p>{dateStr}</p>
          <p>{durLabel}</p>
          <p>{ct.organizer}: {cleanup.organizerName}</p>
          <p>
            {cleanup.participantCount}
            {cleanup.maxParticipants > 0 ? `/${cleanup.maxParticipants}` : ""}{" "}
            {ct.participants}
          </p>
        </div>

        {/* Description */}
        {editing ? (
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={4}
            className="w-full border border-[#8ab5af] rounded-lg px-3 py-2 text-sm mb-4 resize-none"
          />
        ) : desc ? (
          <p className="text-sm text-[#0d3d47] mb-4 whitespace-pre-wrap">{desc}</p>
        ) : null}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {isOrganizer && !editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm border border-[#8ab5af] text-[#145e6a] rounded-lg hover:bg-[#e0f3f8] transition-colors"
              >
                {ct.edit}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {ct.cancel}
              </button>
            </>
          )}
          {editing && (
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 text-sm bg-[#145e6a] text-white rounded-lg hover:bg-[#0e4a54] transition-colors disabled:opacity-50"
            >
              {ct.save}
            </button>
          )}
          {userId && !isOrganizer && (
            isParticipant ? (
              <button
                onClick={handleLeave}
                disabled={loading}
                className="px-4 py-2 text-sm border border-[#8ab5af] text-[#145e6a] rounded-lg hover:bg-[#e0f3f8] transition-colors disabled:opacity-50"
              >
                {ct.leave}
              </button>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
