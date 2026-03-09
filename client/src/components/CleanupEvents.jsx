import { useLang } from "../LangContext";
import { T } from "../i18n";

export default function CleanupEvents({ eventsData }) {
  const { lang } = useLang();
  const t = T[lang];

  if (!eventsData || eventsData.count === 0) return null;

  const past = eventsData.events.filter((e) => !e.upcoming);
  const upcoming = eventsData.events.filter((e) => e.upcoming);
  const epdUrl = eventsData.epdUrl;

  return (
    <section className="bg-white rounded-xl shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">
          {t.cleanupEvents}
          <span className="ml-2 text-xs font-normal text-gray-400">
            {t.withinOneMonth}
          </span>
        </h2>
        <a
          href={epdUrl + "?rel=ue"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          {t.viewAllEpd}
        </a>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1.5">
            {t.upcoming} ({upcoming.length})
          </p>
          <ul className="space-y-1.5">
            {upcoming.map((e, i) => (
              <EventRow key={i} event={e} lang={lang} epdUrl={epdUrl + "?rel=ue"} />
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
            {t.pastMonth} ({past.length})
          </p>
          <ul className="space-y-1.5">
            {past.slice(-5).map((e, i) => (
              <EventRow key={i} event={e} lang={lang} epdUrl={epdUrl + "?rel=ce"} />
            ))}
            {past.length > 5 && (
              <li className="text-xs text-gray-400 pl-1">
                {t.morePast(past.length - 5)}{" "}
                <a
                  href={epdUrl + "?rel=ce"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {t.viewOnEpd}
                </a>
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

function EventRow({ event, lang, epdUrl }) {
  const dateStr = new Date(event.date).toLocaleDateString(
    lang === "tc" ? "zh-HK" : "en-HK",
    { month: "short", day: "numeric" }
  );

  const title = event.title[lang] || event.title.en;
  const location = event.location[lang] || event.location.en;

  return (
    <li className="flex items-start gap-2 text-sm">
      <span className="shrink-0 text-xs text-gray-400 w-12 pt-0.5">
        {dateStr}
      </span>
      <span className="text-gray-700 leading-snug">
        {title}
        {location && (
          <span className="text-gray-400"> · {location}</span>
        )}
      </span>
      <a
        href={event.link || epdUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-xs text-blue-500 hover:underline ml-auto pt-0.5"
      >
        ↗
      </a>
    </li>
  );
}
