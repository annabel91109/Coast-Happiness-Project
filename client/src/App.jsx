import { useState, useEffect } from "react";
import { useApi } from "./hooks/useApi";
import { LangProvider, useLang } from "./LangContext";
import { AuthProvider, useAuth } from "./AuthContext";
import { T } from "./i18n";
import BeachList from "./components/BeachList";
import BeachMap from "./components/BeachMap";
import AuthModal from "./components/AuthModal";
import HostCleanupForm from "./components/HostCleanupForm";
import CleanupList from "./components/CleanupList";
import RecyclingMap from "./components/RecyclingMap";

const PERIODS = ["24h", "1w", "2w", "1m"];

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </LangProvider>
  );
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function oneMonthAgoStr() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const VALID_VIEWS = ["list", "map", "host", "join", "recycling"];

function AppInner() {
  const [view, setView] = useState(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("view") : null;
    return VALID_VIEWS.includes(saved) ? saved : "list";
  });
  useEffect(() => {
    try { window.localStorage.setItem("view", view); } catch { /* ignore quota/privacy errors */ }
  }, [view]);
  const [period, setPeriod] = useState("24h");
  const [customFrom, setCustomFrom] = useState(oneMonthAgoStr);
  const [customTo, setCustomTo] = useState(todayStr);
  const [appliedCustom, setAppliedCustom] = useState(null);
  const [authMode, setAuthMode] = useState(null); // null | "signin" | "signup"
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { lang, setLang } = useLang();
  const t = T[lang];
  const { user, logout } = useAuth();

  const apiUrl = period === "custom" && appliedCustom
    ? `/api/predictions?from=${appliedCustom.from}&to=${appliedCustom.to}`
    : `/api/predictions?period=${period === "custom" ? "1m" : period}`;

  const predictions = useApi(apiUrl);
  const events = useApi("/api/events");

  const loading = predictions.loading;
  const error = predictions.error;

  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  return (
    <div className="flex h-screen bg-[#e0f3f8] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        w-56 flex flex-col bg-[#0d3d47] text-white
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Brand */}
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-2 mb-0.5">
            <img
              src="/logo.jpg"
              alt=""
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
            <span className="font-bold text-sm leading-tight">{t.appTitle}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          {/* Cleanup Action section */}
          <div className="mb-1">
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/50 select-none">
              <span>💪</span>
              <span>{t.navCleanupAction}</span>
            </div>
            <button
              onClick={() => { if (!user) { setAuthMode("signin"); return; } setView("host"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                view === "host"
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base">📋</span>
              {t.navHostCleanup}
            </button>
            <button
              onClick={() => { if (!user) { setAuthMode("signin"); return; } setView("join"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                view === "join"
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base">🤝</span>
              {t.navJoinCleanup}
            </button>
            <button
              onClick={() => { setView("recycling"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                view === "recycling"
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base">♻️</span>
              {t.navRecycling}
            </button>
          </div>

          {/* Trash Predictor section */}
          <div className="mb-1">
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/50 select-none">
              <span>🗑️</span>
              <span>{t.navTrashPredictor}</span>
            </div>
            <button
              onClick={() => { setView("list"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                view === "list"
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base">📊</span>
              {t.navRank}
            </button>
            <button
              onClick={() => { setView("map"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                view === "map"
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base">🗺️</span>
              {t.navMap}
            </button>
          </div>
        </nav>

        {/* Bottom: lang + auth */}
        <div className="px-3 py-4 border-t border-white/10 flex flex-col gap-3">
          {/* Language toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/20 text-sm">
            <button
              onClick={() => setLang("en")}
              className={`flex-1 py-1.5 transition-colors ${lang === "en" ? "bg-white text-[#0d3d47] font-medium" : "text-white/70 hover:bg-white/10"}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang("tc")}
              className={`flex-1 py-1.5 transition-colors ${lang === "tc" ? "bg-white text-[#0d3d47] font-medium" : "text-white/70 hover:bg-white/10"}`}
            >
              中文
            </button>
          </div>

          {/* Auth */}
          {user ? (
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#5a9daa] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(user.displayName || user.email || "?")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{user.displayName || user.email}</p>
                <button onClick={logout} className="text-xs text-white/50 hover:text-white transition-colors">
                  {t.auth.signOut}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex rounded-lg overflow-hidden border border-white/20 text-sm">
              <button
                onClick={() => setAuthMode("signup")}
                className="flex-1 py-1.5 font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                {t.auth.signUp}
              </button>
              <button
                onClick={() => setAuthMode("signin")}
                className="flex-1 py-1.5 font-medium bg-white/10 hover:bg-white/20 text-white transition-colors border-l border-white/20"
              >
                {t.auth.logIn}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-[#145e6a] shadow-sm flex-shrink-0">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-white p-1"
              aria-label="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <rect y="3" width="20" height="2" rx="1"/>
                <rect y="9" width="20" height="2" rx="1"/>
                <rect y="15" width="20" height="2" rx="1"/>
              </svg>
            </button>

            <h1 className="text-white font-semibold text-sm md:text-base">
              {view === "host" ? t.navHostCleanup : view === "join" ? t.navJoinCleanup : view === "recycling" ? t.navRecycling : view === "map" ? t.trashHotspots : t.beachRankings}
            </h1>

            {!online && (
              <span className="text-xs bg-[#c0a040] text-white px-2 py-0.5 rounded-full">
                {t.offline}
              </span>
            )}

            <button
              onClick={() => predictions.refresh()}
              disabled={loading}
              className="ml-auto text-sm bg-white text-[#145e6a] font-medium px-3 py-1.5 rounded-lg hover:bg-[#e0f3f8] transition-colors disabled:opacity-50"
            >
              {loading ? t.loading : t.refresh}
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {view === "host" && (
              <HostCleanupForm
                beaches={predictions.data?.predictions || []}
                events={events.data?.events ?? []}
                onCreated={() => setView("join")}
              />
            )}

            {view === "join" && (
              <CleanupList
                userId={user?.uid}
                epdEvents={events.data?.events}
              />
            )}

            {view === "recycling" && <RecyclingMap />}

            {(view === "list" || view === "map") && error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
                {t.failedLoad}: {error}
              </div>
            )}

            {(view === "list" || view === "map") && loading && !predictions.data && (
              <div className="text-center py-12 text-[#145e6a]">
                {t.loadingWind}
              </div>
            )}

            {/* Period toggle */}
            {(view === "list" || view === "map") && (<>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm text-[#145e6a]">{t.past}</span>
              <div className="flex rounded-lg overflow-hidden border border-[#8ab5af] text-sm w-fit">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 transition-colors ${period === p ? "bg-[#145e6a] text-white" : "bg-white text-[#145e6a] hover:bg-[#e0f3f8]"}`}
                  >
                    {t.periods[p]}
                  </button>
                ))}
                <button
                  onClick={() => setPeriod("custom")}
                  className={`px-3 py-1.5 transition-colors border-l border-[#8ab5af] ${period === "custom" ? "bg-[#145e6a] text-white" : "bg-white text-[#145e6a] hover:bg-[#e0f3f8]"}`}
                >
                  {t.custom}
                </button>
              </div>
            </div>

            {/* Custom date range picker */}
            {period === "custom" && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <input
                  type="date"
                  min={oneMonthAgoStr()}
                  max={customTo || todayStr()}
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  aria-label="Start date"
                  className="border border-[#8ab5af] rounded-lg px-2 py-1.5 text-sm text-[#145e6a] bg-white"
                />
                <span className="text-sm text-[#145e6a]">→</span>
                <input
                  type="date"
                  min={customFrom || oneMonthAgoStr()}
                  max={todayStr()}
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  aria-label="End date"
                  className="border border-[#8ab5af] rounded-lg px-2 py-1.5 text-sm text-[#145e6a] bg-white"
                />
                <button
                  onClick={() => setAppliedCustom({ from: customFrom, to: customTo })}
                  disabled={!customFrom || !customTo}
                  className="px-3 py-1.5 bg-[#145e6a] text-white text-sm rounded-lg hover:bg-[#0e4a54] disabled:opacity-50 transition-colors"
                >
                  {t.apply}
                </button>
              </div>
            )}
            {period !== "custom" && <div className="mb-4" />}

            {predictions.data && (
              <>
                <h2 className="text-lg font-semibold text-black mb-1">
                  {view === "map"
                    ? t.trashHotspots
                    : <>{t.beachRankings} <span className="text-sm font-normal text-[#145e6a]">{t.indexLabel} {t.indexExplain}</span></>}
                </h2>
                {predictions.data.snapshotCount != null && (
                  <p className="text-xs text-[#145e6a] mb-4">
                    {period === "custom" ? t.customRange : `${t.periods[period]} ${t.avg}`} &middot; {predictions.data.snapshotCount} {t.readings}
                    {predictions.data.oldestSnapshot &&
                      ` ${t.from} ${new Date(predictions.data.oldestSnapshot).toLocaleDateString()}`}
                    {predictions.data.newestSnapshot &&
                      ` ${t.to} ${new Date(predictions.data.newestSnapshot).toLocaleDateString()}`}
                  </p>
                )}

                {view === "list" ? (
                  <BeachList
                    predictions={predictions.data.predictions}
                    events={events.data?.events ?? []}
                    sourceUrl={events.data?.sourceUrl}
                  />
                ) : (
                  <BeachMap predictions={predictions.data.predictions} />
                )}
                <p className="text-xs text-[#145e6a] mt-4 text-center">
                  {t.generatedAt}{" "}
                  {new Date(predictions.data.generatedAt).toLocaleTimeString()}
                  {" "}&middot; {t.autoRefresh}
                </p>
              </>
            )}
            </>)}
          </div>
        </main>
      </div>

      {authMode && <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} />}
    </div>
  );
}
