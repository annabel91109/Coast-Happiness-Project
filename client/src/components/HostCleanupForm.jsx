import { useState, useRef, useEffect, useCallback } from "react";
import { useLang } from "../LangContext";
import { useAuth } from "../AuthContext";
import { T } from "../i18n";
import { authFetch } from "../utils/authFetch";
import {
  suggestBeaches,
  buildPlan,
  googleCalendarUrl,
  downloadIcs,
  downloadDoc,
  printPlan,
} from "../utils/cleanupPlan";

const DURATIONS = [60, 120, 180, 240];
const REGIONS = ["HK Island", "Kowloon", "NT", "Islands"];
const TRANSPORT_MODES = ["mtr", "bus", "ferry", "car"];
const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5];

const DIFF_BADGE_COLORS = {
  1: "text-[#5e9e70] bg-[#eef7f0]",
  2: "text-[#6e8c2e] bg-[#f0f6e6]",
  3: "text-[#8b6f1a] bg-[#fbf3e3]",
  4: "text-[#9e5454] bg-[#f7e7e7]",
  5: "text-[#7a3030] bg-[#f3dede]",
};

export default function HostCleanupForm({ beaches, events = [], onCreated }) {
  const { lang } = useLang();
  const { user } = useAuth();
  const t = T[lang];
  const ct = t.cleanup;
  const wt = ct.wizard;

  // Snap-scroll container
  const containerRef = useRef(null);
  const stepRefs = [useRef(null), useRef(null), useRef(null)];
  const [activeStep, setActiveStep] = useState(0);

  // Step 1: preferences
  const [regions, setRegions] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  const [groupSize, setGroupSize] = useState(5);
  const [transportModes, setTransportModes] = useState(["mtr"]);
  const [dateTime, setDateTime] = useState("");
  const [duration, setDuration] = useState(120);
  const [includeGazetted, setIncludeGazetted] = useState(false);
  const [diffMin, setDiffMin] = useState(1);
  const [diffMax, setDiffMax] = useState(5);

  // Step 2: suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [selectedBeach, setSelectedBeach] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualSearch, setManualSearch] = useState("");

  // Step 3: plan
  const [plan, setPlan] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(0);
  const [planName, setPlanName] = useState("");
  const [savedPlans, setSavedPlans] = useState([]);
  const [myCleanups, setMyCleanups] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Sorted beach list for manual picker
  const beachList = beaches
    ? [...new Map(beaches.map((b) => [b.beach, b])).values()].sort((a, b) => {
        const nameA = lang === "tc" && a.nameTc ? a.nameTc : a.beach;
        const nameB = lang === "tc" && b.nameTc ? b.nameTc : b.beach;
        return nameA.localeCompare(nameB);
      })
    : [];

  // Min datetime: now + 1 hour. The form keeps `dateTime` as the single
  // source of truth (YYYY-MM-DDTHH:mm) but exposes it as separate date
  // and time controls — `datetime-local` is too fiddly on mobile and
  // forces minute-level precision nobody picks for a beach cleanup.
  const minDateTime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
  const minDate = minDateTime.slice(0, 10);
  const dateOnly = dateTime ? dateTime.slice(0, 10) : "";
  const timeOnly = dateTime ? dateTime.slice(11, 16) : "";

  const TIME_SLOTS = [
    "06:00","07:00","08:00","09:00","10:00","11:00",
    "12:00","13:00","14:00","15:00","16:00","17:00",
  ];

  // 24-hour ("09:00", "14:00") — same string in either locale, no AM/PM.
  function formatSlot(hhmm) {
    return hhmm;
  }

  function updateDate(newDate) {
    setDateTime(`${newDate}T${timeOnly || "09:00"}`);
  }
  function updateTime(newTime) {
    setDateTime(`${dateOnly || minDate}T${newTime}`);
  }

  // Observe which step is visible
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = stepRefs.findIndex((r) => r.current === e.target);
            if (idx !== -1) setActiveStep(idx);
          }
        });
      },
      { root, threshold: [0.6] }
    );
    stepRefs.forEach((r) => r.current && observer.observe(r.current));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToStep = useCallback((idx) => {
    stepRefs[idx]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved plans + my cleanups when user available
  const loadMyCleanups = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch("GET", "/api/cleanups?mine=true");
      const mine = (res.cleanups || []).filter((c) => c.organizerUid === user.uid);
      setMyCleanups(mine);
    } catch {
      // silently ignore
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await authFetch("GET", "/api/cleanups/saved/list");
        setSavedPlans(res.plans || []);
      } catch {
        // silently ignore
      }
    })();
    loadMyCleanups();
  }, [user, loadMyCleanups]);

  function toggleRegion(r) {
    setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  const [locStatus, setLocStatus] = useState("idle"); // idle | loading | ok | error
  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocStatus("error");
      setError("Geolocation not supported by this browser");
      return;
    }
    setLocStatus("loading");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("ok");
      },
      (err) => {
        setLocStatus("error");
        setError(`Location: ${err.message}`);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  // Build a set of beach names that already have an upcoming HandsOn HK
  // cleanup — including the "Filled" / closed-to-public ones, since we
  // still don't want a duplicate event on the same beach. The set is
  // computed from the events feed so it stays in sync with whatever the
  // backend is currently returning.
  const excludeBeachNames = new Set(
    (events || [])
      .filter((e) => e && e.upcoming && e.matchedBeach)
      .map((e) => e.matchedBeach)
  );

  function handleFindBeaches(e) {
    e?.preventDefault();
    setError(null);
    if (!dateTime) {
      setError(ct.dateTime + " required");
      return;
    }
    const suggested = suggestBeaches(beaches || [], {
      regions,
      userLat: userCoords?.lat,
      userLng: userCoords?.lng,
      includeGazetted,
      diffMin,
      diffMax,
      excludeBeachNames,
    }, 3);
    setSuggestions(suggested);
    setManualMode(false);
    scrollToStep(1);
  }

  function choosePickedBeach(beach) {
    setSelectedBeach(beach);
    const newPlan = buildPlan({
      beach,
      dateTime,
      durationMinutes: duration,
      groupSize,
      transportModes,
      title: lang === "tc"
        ? `${beach.beach || beach.name} 清潔活動`
        : `Cleanup at ${beach.beach || beach.name}`,
      description: "",
      lang,
    });
    setPlan(newPlan);
    setTitle(newPlan.title);
    setDescription(newPlan.description);
    setPlanName(newPlan.title);
    setCurrentPlanId(null);
    scrollToStep(2);
  }

  // Keep plan in sync when user edits title/desc
  useEffect(() => {
    if (!plan) return;
    setPlan((p) => (p ? { ...p, title, description } : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description]);

  async function handleSavePlan() {
    if (!user) {
      setError(wt.needSignIn);
      return;
    }
    if (!plan || !planName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (currentPlanId) {
        const updated = await authFetch("PUT", `/api/cleanups/saved/list/${currentPlanId}`, {
          name: planName,
          plan,
        });
        setSavedPlans((prev) => prev.map((p) => (p.id === currentPlanId ? updated : p)));
      } else {
        const created = await authFetch("POST", "/api/cleanups/saved/list", {
          name: planName,
          plan,
        });
        setSavedPlans((prev) => [created, ...prev]);
        setCurrentPlanId(created.id);
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleLoadPlan(p) {
    setPlan(p.plan);
    setTitle(p.plan.title || "");
    setDescription(p.plan.description || "");
    setPlanName(p.name);
    setCurrentPlanId(p.id);
    setDateTime(p.plan.dateTime?.slice(0, 16) || "");
    setDuration(p.plan.durationMinutes || 120);
    setGroupSize(p.plan.groupSize || 5);
    setSelectedBeach({
      beach: p.plan.beach.name,
      name: p.plan.beach.name,
      nameTc: p.plan.beach.nameTc,
      region: p.plan.beach.region,
      gazetted: p.plan.beach.gazetted,
      lat: p.plan.beach.lat,
      lng: p.plan.beach.lng,
    });
    scrollToStep(2);
  }

  async function handleDeletePlan(id) {
    try {
      await authFetch("DELETE", `/api/cleanups/saved/list/${id}`);
      setSavedPlans((prev) => prev.filter((p) => p.id !== id));
      if (currentPlanId === id) setCurrentPlanId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRenamePlan(id) {
    const current = savedPlans.find((p) => p.id === id);
    if (!current) return;
    const newName = window.prompt(wt.renamePlan, current.name);
    if (!newName || newName === current.name) return;
    try {
      const updated = await authFetch("PUT", `/api/cleanups/saved/list/${id}`, { name: newName });
      setSavedPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateEvent() {
    setSubmitting(true);
    setError(null);
    try {
      await authFetch("POST", "/api/cleanups", {
        beachName: plan.beach.name,
        title,
        description,
        dateTime: plan.dateTime,
        durationMinutes: plan.durationMinutes,
        maxParticipants,
      });
      setSuccess(true);
      loadMyCleanups();
      if (onCreated) onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <div className="text-3xl mb-3">🎉</div>
        <h2 className="text-lg font-semibold text-[#0d3d47] mb-2">{ct.success}</h2>
        <button
          onClick={() => {
            setSuccess(false);
            setPlan(null);
            setSelectedBeach(null);
            setSuggestions([]);
            scrollToStep(0);
          }}
          className="mt-3 px-4 py-2 bg-[#145e6a] text-white rounded-lg text-sm hover:bg-[#0e4a54] transition-colors"
        >
          {t.navHostCleanup}
        </button>
      </div>
    );
  }

  // ---------- Render ----------

  return (
    <div className="relative">
      {/* My cleanups summary */}
      {user && myCleanups.length > 0 && (
        <div className="mb-3 bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[#0d3d47]">
              {ct.myCleanups} <span className="text-[#145e6a]">({myCleanups.length})</span>
            </h3>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {myCleanups.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs bg-[#f0f7f6] rounded px-3 py-1.5">
                <span className="text-[#0d3d47] truncate flex-1">{c.title}</span>
                <span className="text-[#5a7d80] ml-2 flex-shrink-0">
                  {new Date(c.dateTime).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step indicator dots */}
      <div className="sticky top-0 z-10 flex justify-center gap-2 py-2 bg-[#f0f7f6]/90 backdrop-blur-sm rounded-lg mb-2">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            onClick={() => scrollToStep(i)}
            aria-label={`Step ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              activeStep === i ? "w-8 bg-[#145e6a]" : "w-2 bg-[#8ab5af]"
            }`}
          />
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">
          {error}
        </div>
      )}

      {/* Snap-scroll wizard container */}
      <div
        ref={containerRef}
        className="h-[75vh] overflow-y-auto snap-y snap-mandatory scroll-smooth rounded-xl"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {/* ---------- STEP 1: Preferences ---------- */}
        <section
          ref={stepRefs[0]}
          className="snap-start min-h-[75vh] bg-white rounded-xl shadow-sm p-6 mb-4"
          style={{ scrollSnapAlign: "start" }}
        >
          <h2 className="text-lg font-semibold text-[#0d3d47]">{wt.step1Title}</h2>
          <p className="text-sm text-[#5a7d80] mb-4">{wt.step1Sub}</p>

          <form onSubmit={handleFindBeaches} className="space-y-4">
            {/* Regions */}
            <div>
              <label className="block text-sm font-medium text-[#0d3d47] mb-2">{wt.regions}</label>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => toggleRegion(r)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      regions.includes(r)
                        ? "bg-[#145e6a] text-white border-[#145e6a]"
                        : "bg-white text-[#0d3d47] border-[#8ab5af]"
                    }`}
                  >
                    {t.regions[r] || r}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={useMyLocation}
                className="mt-2 text-xs text-[#145e6a] underline"
              >
                📍 {wt.useLocation}
                {locStatus === "loading" && " …"}
                {locStatus === "ok" && userCoords && ` ✓ (${userCoords.lat.toFixed(3)}, ${userCoords.lng.toFixed(3)})`}
                {locStatus === "error" && " ✕"}
              </button>
            </div>

            {/* Date/time + duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0d3d47] mb-1">{ct.dateTime}</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    min={minDate}
                    value={dateOnly}
                    onChange={(e) => updateDate(e.target.value)}
                    className="w-full border border-[#8ab5af] rounded-lg px-3 py-2 text-sm text-[#0d3d47]"
                  />
                  <select
                    required
                    value={timeOnly}
                    onChange={(e) => updateTime(e.target.value)}
                    className="w-full border border-[#8ab5af] rounded-lg px-3 py-2 text-sm bg-white text-[#0d3d47]"
                  >
                    <option value="" disabled>—</option>
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>{formatSlot(t)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0d3d47] mb-1">{ct.duration}</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full border border-[#8ab5af] rounded-lg px-3 py-2 text-sm bg-white text-[#0d3d47]"
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>{ct[`dur${d}`]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Group size */}
            <div>
              <label className="block text-sm font-medium text-[#0d3d47] mb-1">{wt.groupSize}</label>
              <input
                type="number"
                min={1}
                max={100}
                value={groupSize}
                onChange={(e) => setGroupSize(Number(e.target.value))}
                className="w-32 border border-[#8ab5af] rounded-lg px-3 py-2 text-sm text-[#0d3d47]"
              />
            </div>

            {/* Transport */}
            <div>
              <label className="block text-sm font-medium text-[#0d3d47] mb-2">{wt.transport}</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TRANSPORT_MODES.map((m) => {
                  const active = transportModes.includes(m);
                  return (
                    <button
                      type="button"
                      key={m}
                      onClick={() =>
                        setTransportModes((prev) =>
                          prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
                        )
                      }
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                        active
                          ? "bg-[#145e6a] text-white border-[#145e6a]"
                          : "bg-white text-[#0d3d47] border-[#8ab5af]"
                      }`}
                    >
                      {wt[`transport${m[0].toUpperCase() + m.slice(1)}`]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Include gazetted */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGazetted}
                  onChange={(e) => setIncludeGazetted(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-[#0d3d47]">{wt.includeGazetted}</div>
                  <div className="text-xs text-[#5a7d80]">{wt.nonGazettedHint}</div>
                </div>
              </label>
            </div>

            {/* Difficulty range */}
            <div>
              <label className="block text-sm font-medium text-[#0d3d47] mb-2">
                {t.difficultyFilter.label}
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#0d3d47]">
                <label className="flex items-center gap-1">
                  <span className="text-[#5a7d80]">{t.difficultyFilter.min}</span>
                  <select
                    value={diffMin}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setDiffMin(n);
                      if (n > diffMax) setDiffMax(n);
                    }}
                    className="border border-[#8ab5af] rounded px-2 py-1 bg-white text-[#0d3d47]"
                  >
                    {DIFFICULTY_LEVELS.map((n) => (
                      <option key={n} value={n}>
                        {n} — {t.access.levels[n]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-[#5a7d80]">{t.difficultyFilter.max}</span>
                  <select
                    value={diffMax}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setDiffMax(n);
                      if (n < diffMin) setDiffMin(n);
                    }}
                    className="border border-[#8ab5af] rounded px-2 py-1 bg-white text-[#0d3d47]"
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

            <button
              type="submit"
              className="w-full py-2.5 bg-[#145e6a] text-white font-medium rounded-lg text-sm hover:bg-[#0e4a54] transition-colors"
            >
              {wt.next} ↓
            </button>

            {/* Saved plans (if any) */}
            {user && savedPlans.length > 0 && (
              <div className="pt-4 border-t border-[#e0ecec]">
                <div className="text-sm font-medium text-[#0d3d47] mb-2">{wt.loadPlan}</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {savedPlans.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm bg-[#f0f7f6] rounded-lg px-3 py-2">
                      <button
                        onClick={() => handleLoadPlan(p)}
                        className="flex-1 text-left text-[#0d3d47] truncate hover:underline"
                      >
                        {p.name}
                      </button>
                      <button
                        onClick={() => handleRenamePlan(p.id)}
                        className="text-xs text-[#145e6a]"
                      >
                        {wt.renamePlan}
                      </button>
                      <button
                        onClick={() => handleDeletePlan(p.id)}
                        className="text-xs text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </section>

        {/* ---------- STEP 2: Suggestions ---------- */}
        <section
          ref={stepRefs[1]}
          className="snap-start min-h-[75vh] bg-white rounded-xl shadow-sm p-6 mb-4"
          style={{ scrollSnapAlign: "start" }}
        >
          <h2 className="text-lg font-semibold text-[#0d3d47]">{wt.step2Title}</h2>
          <p className="text-sm text-[#5a7d80] mb-4">{wt.step2Sub}</p>

          {suggestions.length === 0 && !manualMode && (
            <div className="text-sm text-[#5a7d80] bg-[#f0f7f6] p-4 rounded-lg">
              {wt.noBeachesFound}
            </div>
          )}

          {!manualMode && suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((b, i) => (
                <div
                  key={b.beach}
                  className="border border-[#8ab5af] rounded-xl p-4 hover:border-[#145e6a] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex w-6 h-6 rounded-full bg-[#145e6a] text-white text-xs font-semibold items-center justify-center leading-none">
                          {i + 1}
                        </span>
                        <h3 className="font-semibold text-[#0d3d47]">
                          {lang === "tc" && b.nameTc ? b.nameTc : b.beach}
                        </h3>
                        {!b.gazetted && (
                          <span className="text-xs px-2 py-0.5 bg-[#fff7e6] text-[#a66b00] rounded">
                            non-gazetted
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[#5a7d80]">
                        {t.regions[b.region] || b.region}
                        {b._distKm > 0 && ` · ${wt.distance}: ${b._distKm.toFixed(1)} km`}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {b.accessDifficulty != null && (
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${DIFF_BADGE_COLORS[b.accessDifficulty] || "text-[#145e6a] bg-[#f0f7f6]"}`}
                            title={t.access.hints[b.accessDifficulty]}
                          >
                            {b.accessDifficulty} · {t.access.levels[b.accessDifficulty]}
                          </span>
                        )}
                        {b.hikeMinutes != null && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#fbf3e3] text-[#8b6f3a] font-medium">
                            {t.hikeBadge(b.hikeMinutes)}
                          </span>
                        )}
                        {b.boatOnly && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#e6f1f6] text-[#2c6f80] font-medium">
                            {t.boatBadge}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-[#0d3d47]">
                        {wt.predictedTrash}: {b._trash ? `${(b._trash * 100).toFixed(0)}%` : "—"}{b.riskLevel ? ` (${t.risk[b.riskLevel] || b.riskLevel})` : ""}
                      </div>
                      <a
                        href={
                          b.placeId
                            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((b.beach || b.name) + " Hong Kong")}&query_place_id=${b.placeId}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((b.beach || b.name) + " beach Hong Kong")}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-[#145e6a] underline"
                      >
                        📍 View on Google Maps
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={() => choosePickedBeach(b)}
                    className="mt-3 w-full py-2 bg-[#145e6a] text-white rounded-lg text-sm hover:bg-[#0e4a54] transition-colors"
                  >
                    {wt.pick}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Manual picker */}
          <div className="mt-4 pt-4 border-t border-[#e0ecec]">
            {!manualMode ? (
              <button
                onClick={() => setManualMode(true)}
                className="text-sm text-[#145e6a] underline"
              >
                {wt.manualPick}
              </button>
            ) : (
              <div>
                <label className="block text-sm font-medium text-[#0d3d47] mb-1">{ct.selectBeach}</label>
                <input
                  type="text"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  placeholder="Search beaches..."
                  className="w-full border border-[#8ab5af] rounded-lg px-3 py-2 text-sm text-[#0d3d47] mb-2"
                />
                <div className="max-h-60 overflow-y-auto border border-[#e0ecec] rounded-lg divide-y divide-[#e0ecec]">
                  {beachList
                    .filter((b) => {
                      if (!manualSearch.trim()) return true;
                      const q = manualSearch.toLowerCase();
                      return (
                        b.beach.toLowerCase().includes(q) ||
                        (b.nameTc && b.nameTc.includes(manualSearch)) ||
                        (b.region && b.region.toLowerCase().includes(q))
                      );
                    })
                    .map((b) => (
                      <button
                        key={b.beach}
                        type="button"
                        onClick={() => choosePickedBeach(b)}
                        className="w-full text-left px-3 py-2 text-sm text-[#0d3d47] hover:bg-[#f0f7f6] transition-colors"
                      >
                        {lang === "tc" && b.nameTc ? b.nameTc : b.beach}
                        {b.region && (
                          <span className="text-xs text-[#5a7d80] ml-1">
                            ({t.regions[b.region] || b.region})
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between">
            <button
              onClick={() => scrollToStep(0)}
              className="text-sm text-[#145e6a] underline"
            >
              ← {wt.back}
            </button>
          </div>
        </section>

        {/* ---------- STEP 3: Plan ---------- */}
        <section
          ref={stepRefs[2]}
          className="snap-start min-h-[75vh] bg-white rounded-xl shadow-sm p-6"
          style={{ scrollSnapAlign: "start" }}
        >
          <h2 className="text-lg font-semibold text-[#0d3d47]">{wt.step3Title}</h2>
          <p className="text-sm text-[#5a7d80] mb-4">{wt.step3Sub}</p>

          {!plan ? (
            <div className="text-sm text-[#5a7d80] bg-[#f0f7f6] p-4 rounded-lg">
              ← {wt.back}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Title & description */}
              <div>
                <label className="block text-sm font-medium text-[#0d3d47] mb-1">{ct.title}</label>
                <input
                  type="text"
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-[#8ab5af] rounded-lg px-3 py-2 text-sm text-[#0d3d47]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0d3d47] mb-1">{ct.description}</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-[#8ab5af] rounded-lg px-3 py-2 text-sm text-[#0d3d47] resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0d3d47] mb-1">
                  {ct.maxParticipants} <span className="text-xs text-[#8ab5af]">({ct.maxHelp})</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="w-32 border border-[#8ab5af] rounded-lg px-3 py-2 text-sm text-[#0d3d47]"
                />
              </div>

              {/* Plan summary */}
              <div className="bg-[#f0f7f6] rounded-lg p-4 space-y-3 text-sm">
                <div>
                  <div className="font-semibold text-[#145e6a]">🚍 {wt.transportHeading}</div>
                  <p className="text-[#0d3d47] mt-1 whitespace-pre-line">{plan.transport.instructions}</p>
                </div>
                <div>
                  <div className="font-semibold text-[#145e6a]">♻️ {wt.recyclingHeading}</div>
                  <ul className="mt-1 space-y-1 list-disc list-inside text-[#0d3d47]">
                    {plan.recycling.map((r, i) => (
                      <li key={i}>
                        <strong>{r.name}</strong> — {r.address}
                        <span className="block text-xs text-[#5a7d80] ml-4">{r.materials}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-[#145e6a]">🎒 {wt.checklistHeading}</div>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside text-[#0d3d47]">
                    {plan.checklist.map((c, i) => (
                      <li key={i}>
                        {c.item} <span className="text-xs text-[#5a7d80]">({c.qty})</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 text-xs text-[#5a7d80] bg-[#f0f7f6] rounded-md px-2 py-1.5">
                    {wt.lendingNote}{" "}
                    <a
                      href="https://www.greenpower.org.hk/nature-rescue-clean-up-materials-lending-service"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#145e6a] underline hover:text-[#0e4a54]"
                    >
                      {wt.lendingLinkLabel} ↗
                    </a>
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-[#145e6a]">⚠️ {wt.safetyHeading}</div>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside text-[#0d3d47]">
                    {plan.safetyNotes.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </div>

              {/* Save plan */}
              <div className="border border-[#e0ecec] rounded-lg p-3">
                <label className="block text-sm font-medium text-[#0d3d47] mb-1">{wt.planName}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={80}
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="flex-1 border border-[#8ab5af] rounded-lg px-3 py-2 text-sm text-[#0d3d47]"
                  />
                  <button
                    onClick={handleSavePlan}
                    disabled={saving || !user || !planName.trim()}
                    className="px-4 py-2 bg-[#145e6a] text-white rounded-lg text-sm hover:bg-[#0e4a54] transition-colors disabled:opacity-50"
                  >
                    {savedFlash ? wt.saved : wt.savePlan}
                  </button>
                </div>
                {!user && <div className="text-xs text-[#a66b00] mt-1">{wt.needSignIn}</div>}
              </div>

              {/* Export / share */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <a
                  href={googleCalendarUrl(plan)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-center px-3 py-2 border border-[#145e6a] text-[#145e6a] rounded-lg text-xs hover:bg-[#f0f7f6] transition-colors"
                >
                  📅 {wt.addToGoogle}
                </a>
                <button
                  onClick={() => downloadIcs(plan)}
                  className="px-3 py-2 border border-[#145e6a] text-[#145e6a] rounded-lg text-xs hover:bg-[#f0f7f6] transition-colors"
                >
                  📆 {wt.downloadIcs}
                </button>
                <button
                  onClick={() => downloadDoc(plan)}
                  className="px-3 py-2 border border-[#145e6a] text-[#145e6a] rounded-lg text-xs hover:bg-[#f0f7f6] transition-colors"
                >
                  📄 {wt.downloadDoc}
                </button>
                <button
                  onClick={() => printPlan(plan)}
                  className="px-3 py-2 border border-[#145e6a] text-[#145e6a] rounded-lg text-xs hover:bg-[#f0f7f6] transition-colors"
                >
                  🖨 {wt.printPdf}
                </button>
              </div>

              {/* Create event */}
              <button
                onClick={handleCreateEvent}
                disabled={submitting}
                className="w-full py-2.5 bg-[#145e6a] text-white font-medium rounded-lg text-sm hover:bg-[#0e4a54] transition-colors disabled:opacity-50"
              >
                {submitting ? ct.creating : wt.createEvent}
              </button>

              <button
                onClick={() => scrollToStep(1)}
                className="block text-sm text-[#145e6a] underline"
              >
                ← {wt.back}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
