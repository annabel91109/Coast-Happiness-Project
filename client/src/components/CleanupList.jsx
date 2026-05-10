import { useState, useEffect, useCallback } from "react";
import { useLang } from "../LangContext";
import { T } from "../i18n";
import { authFetch } from "../utils/authFetch";
import CleanupCard from "./CleanupCard";
import CleanupMap from "./CleanupMap";
import CleanupDetail from "./CleanupDetail";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const REGIONS = ["All", "HK Island", "Lantau", "Lamma", "Cheung Chau", "Sai Kung", "Sha Tin", "Tsuen Wan", "Tuen Mun", "Tai Po", "North", "Peng Chau"];

export default function CleanupList({ userId, epdEvents }) {
  const { lang } = useLang();
  const t = T[lang];
  const ct = t.cleanup;

  const [cleanups, setCleanups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subView, setSubView] = useState("list"); // "list" | "map"
  const [activeRegion, setActiveRegion] = useState("All");
  const [myOnly, setMyOnly] = useState(false);
  const [selectedCleanup, setSelectedCleanup] = useState(null);

  const fetchCleanups = useCallback(async () => {
    setError(null);
    try {
      let url = "/api/cleanups";
      if (myOnly && userId) {
        const data = await authFetch("GET", "/api/cleanups?mine=true");
        setCleanups(data.cleanups || []);
      } else {
        const res = await fetch(`${API_BASE}${url}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCleanups(data.cleanups || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [myOnly, userId]);

  useEffect(() => {
    fetchCleanups();
  }, [fetchCleanups]);

  function handleUpdate(updated) {
    setCleanups((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    if (selectedCleanup?.id === updated.id) setSelectedCleanup(updated);
  }

  // Filter by region
  const filtered = activeRegion === "All"
    ? cleanups
    : cleanups.filter((c) => c.region === activeRegion);

  // Convert HandsOn HK opportunities into cleanup-like objects for unified
  // display. We only list events that are upcoming AND open to public
  // signup — events where SpotsAvailable=0 / TypeIndicator=Filled stay in
  // the feed (so the host wizard can deduplicate beaches) but never reach
  // this list.
  const externalCleanups = (epdEvents || [])
    .filter((e) => e.upcoming && e.joinable && e.link)
    .map((e, i) => ({
      id: `ext-${i}`,
      beachName: e.matchedBeach || e.location?.en || "",
      beachNameTc: e.location?.tc || null,
      title: e.title?.en || e.title,
      titleTc: e.title?.tc || null,
      dateTime: e.date,
      region: e.district?.en || "",
      regionTc: e.district?.tc || null,
      locationEn: e.location?.en || "",
      locationTc: e.location?.tc || "",
      organizer: e.organizer || null,
      timeRange: e.timeRange || null,
      spotsAvailable: e.spotsAvailable,
      isEpd: true,
      link: e.link,
      hasDirectLink: true,
    }));

  // Default view shows external (HandsOn) cleanups only. "My Cleanups" mode
  // shows the user's own community cleanups.
  const allItems = myOnly
    ? [...filtered].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
    : [...externalCleanups].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  return (
    <div>
      {/* Sub-view toggle + My Cleanups */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-[#8ab5af] text-sm">
          <button
            onClick={() => setSubView("list")}
            className={`px-3 py-1.5 transition-colors ${subView === "list" ? "bg-[#145e6a] text-white" : "bg-white text-[#145e6a] hover:bg-[#e0f3f8]"}`}
          >
            {ct.listView}
          </button>
          <button
            onClick={() => setSubView("map")}
            className={`px-3 py-1.5 transition-colors ${subView === "map" ? "bg-[#145e6a] text-white" : "bg-white text-[#145e6a] hover:bg-[#e0f3f8]"}`}
          >
            {ct.mapView}
          </button>
        </div>

        {userId && (
          <div className="flex rounded-lg overflow-hidden border border-[#8ab5af] text-sm">
            <button
              onClick={() => setMyOnly(false)}
              className={`px-3 py-1.5 transition-colors ${!myOnly ? "bg-[#145e6a] text-white" : "bg-white text-[#145e6a] hover:bg-[#e0f3f8]"}`}
            >
              {ct.allCleanups}
            </button>
            <button
              onClick={() => setMyOnly(true)}
              className={`px-3 py-1.5 transition-colors border-l border-[#8ab5af] ${myOnly ? "bg-[#145e6a] text-white" : "bg-white text-[#145e6a] hover:bg-[#e0f3f8]"}`}
            >
              {ct.myCleanups}
            </button>
          </div>
        )}
      </div>

      {/* Region chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRegion(r)}
            aria-pressed={activeRegion === r}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeRegion === r
                ? "bg-[#145e6a] text-white border-[#145e6a]"
                : "bg-white text-[#145e6a] border-[#8ab5af] hover:bg-[#e0f3f8]"
            }`}
          >
            {t.regions[r] || r}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-[#145e6a] text-sm">{t.loading}</div>
      )}

      {!loading && subView === "map" && (
        <CleanupMap
          cleanups={filtered}
          epdEvents={externalCleanups}
          userId={userId}
          onUpdate={handleUpdate}
          onSelect={setSelectedCleanup}
        />
      )}

      {!loading && subView === "list" && (
        <div className="space-y-3">
          {allItems.length === 0 && (
            <p className="text-[#8ab5af] text-center py-6 text-sm">
              {myOnly ? ct.noMyCleanups : ct.noCleanups}
            </p>
          )}
          {allItems.map((item) => (
            <CleanupCard
              key={item.id}
              cleanup={item}
              userId={userId}
              isEpd={item.isEpd}
              onUpdate={handleUpdate}
              onSelect={setSelectedCleanup}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedCleanup && !selectedCleanup.isEpd && (
        <CleanupDetail
          cleanup={selectedCleanup}
          userId={userId}
          onUpdate={handleUpdate}
          onClose={() => setSelectedCleanup(null)}
        />
      )}
    </div>
  );
}
