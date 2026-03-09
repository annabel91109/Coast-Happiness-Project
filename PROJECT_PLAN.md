# Coast Happiness Project — Project Plan

## Overview
A Hong Kong beach debris forecasting web app. Pulls live wind data from HKO and wave data from Open-Meteo, runs an algorithmic prediction engine across 50+ beaches, and displays ranked risk scores in a bilingual (EN/TC) React UI. Users can also view nearby beach cleanup events from EPD.

---

## Architecture

```
┌─────────────────────────────┐      ┌───────────────────────────────────┐
│  React App (Vite + Tailwind) │ ───► │  Node.js / Express API Server      │
│  /client                     │ ◄─── │  /server                           │
└─────────────────────────────┘      └───────────────────────────────────┘
                                              │             │            │
                                              ▼             ▼            ▼
                                        HKO Wind API  Open-Meteo   EPD Events
                                        (10-min CSV)  Marine API   (web scrape)
```

---

## Tech Stack

| Layer        | Technology                                          |
|--------------|-----------------------------------------------------|
| Frontend     | React, Vite, Tailwind CSS                           |
| Backend      | Node.js, Express                                    |
| Prediction   | Algorithmic engine (wind onshore + wave + river proximity scores) |
| Auth         | Firebase (Google, Apple, Email/Password)            |
| Data Sources | HKO wind CSV, Open-Meteo Marine API, EPD events     |
| i18n         | English + Traditional Chinese                       |
| Dev Tools    | ESLint, nodemon, Jest (unit tests)                  |

---

## Current File Structure

```
Coast Happiness Project/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BeachList.jsx       — ranked list with region/gazetted filters
│   │   │   ├── BeachCard.jsx       — individual beach score card
│   │   │   ├── BeachMap.jsx        — map view of hotspots
│   │   │   ├── WindSummary.jsx     — current wind conditions panel
│   │   │   ├── CleanupEvents.jsx   — EPD beach cleanup events
│   │   │   └── AuthModal.jsx       — sign in / create account modal
│   │   ├── hooks/
│   │   │   └── useApi.js           — data fetching hook with refresh
│   │   ├── AuthContext.jsx         — Firebase auth state
│   │   ├── LangContext.jsx         — EN/TC language state
│   │   ├── firebase.js             — Firebase config (⚠ needs real credentials)
│   │   ├── i18n.js                 — all UI strings in EN + TC
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── dist/                       — production build output
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── data/
│   │   ├── beaches.json            — all beaches (lat/lng, orientation, region, etc.)
│   │   ├── events-cache.json       — cached EPD events
│   │   └── wind-history.json       — persisted wind snapshots
│   ├── routes/
│   │   ├── predictions.js          — GET /api/predictions
│   │   ├── wind.js                 — GET /api/wind
│   │   └── events.js               — GET /api/events
│   ├── services/
│   │   ├── predictionEngine.js     — scoring logic (wind + wave + river)
│   │   ├── windFetcher.js          — polls HKO CSV every 10 min
│   │   ├── windHistory.js          — snapshot storage and period queries
│   │   ├── marineFetcher.js        — polls Open-Meteo every 1 hr
│   │   ├── eventsFetcher.js        — scrapes EPD cleanup events
│   │   ├── predictionEngine.test.js
│   │   └── windFetcher.test.js
│   ├── index.js
│   └── package.json
└── PROJECT_PLAN.md
```

---

## API Endpoints

| Method | Route               | Description                                        |
|--------|---------------------|----------------------------------------------------|
| GET    | `/api/health`       | Server health check                                |
| GET    | `/api/wind`         | Current wind data from all HKO stations            |
| GET    | `/api/predictions`  | Beach risk scores (live, or `?period=24h/1w/2w/1m`, or `?from=&to=` custom range) |
| GET    | `/api/events`       | Upcoming + recent beach cleanup events from EPD    |

---

## Prediction Engine

Scores each beach on a 0–10 index (higher = more debris expected):

- **Wind score (60%)** — onshore alignment × wind speed, averaged across nearest HKO stations; gust bonus applied
- **Wave score (20%)** — onshore wave alignment × wave height (capped at 3m), from Open-Meteo Marine API
- **River proximity (20%)** — exponential decay from 6 Pearl River / Deep Bay / Tolo Harbour river mouths
- **Bay multiplier** — applied per-beach to model trapping effect in enclosed bays
- **Exposure factor** — per-beach scalar for open vs sheltered coast

Risk levels: Low (<0.25) · Moderate (0.25–0.5) · High (0.5–0.75) · Very High (≥0.75)

---

## Features Completed

- [x] React frontend with sidebar navigation, responsive layout (mobile + desktop)
- [x] Beach rankings view — sorted by predicted debris score
- [x] Map view — hotspot overlay on beach locations
- [x] Period toggle: 1 Day / 1 Week / 2 Weeks / 1 Month / Custom date range
- [x] Region filter (12 regions) + Gazetted/Non-Gazetted toggle
- [x] Beach cleanup events panel (EPD scrape, upcoming + past)
- [x] Wind data polling (HKO CSV, every 10 min) with in-memory + file-persisted history
- [x] Marine wave data polling (Open-Meteo, every 1 hr)
- [x] Firebase authentication (Google, Apple, Email/Password)
- [x] Bilingual UI (English + Traditional Chinese)
- [x] Offline banner with cached data fallback
- [x] Production build served from Express (`/client/dist`)
- [x] Unit tests for prediction engine and wind fetcher

---

## Remaining / Next Steps

- [ ] **Firebase config** — fill in real credentials in `client/src/firebase.js`
- [ ] **Root `package.json`** — add workspace-level dev script to start client + server together
- [ ] **Deployment** — choose hosting (e.g. Render/Railway for server + Vercel for client, or single-server deploy)
- [ ] **Improve historical accuracy** — add tidal data as a 4th scoring factor
- [ ] **User-facing features** — save favourite beaches, push notifications for high-risk days
- [ ] **Data quality** — validate and expand `beaches.json` (orientations, bay factors, exposure)
- [ ] **CI** — add GitHub Actions to run tests on push
