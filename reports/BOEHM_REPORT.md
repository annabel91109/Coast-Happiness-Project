# Coast Happiness Project — Technical Report

**For:** Prof. Alexandria Boehm — Stanford Environmental Systems Engineering
**Prepared by:** Annabel (s2286943@ed.ac.uk), University of Edinburgh
**Live system:** https://coast-happiness-project.web.app
**Date:** May 2026

---

## 1. Problem and scope

Hong Kong has roughly 850km of coastline and persistent marine debris
loading, but the public-facing tooling for "where is trash likely to
accumulate today, and should I clean there?" is essentially nil.
Predictive water-quality work has plenty of precedent in your group
(beach-side FIB nowcasts, hydrodynamic-driven forecasts) — there is
much less for marine debris, where the physical signal is dominated
by surface wind and surface currents rather than runoff microbiology.

The system is a low-cost, observational-data-only predictor for
relative trash accumulation across 86 beaches and 6 documented
hotspots in Hong Kong, packaged as a public-facing app that also
schedules and de-duplicates community cleanups.

---

## 2. Model

The per-beach trash index `S ∈ [0, 1]` is computed every 6 hours as:

```
S = clamp(0, 1, (dynamic + 0.25 · H) · M_bay)
dynamic = (0.45 · W + 0.15 · V + 0.15 · R) · E
M_bay   = 1 + 0.3 · b
```

with components:

| Symbol | Meaning | Source |
|---|---|---|
| `W` | Onshore wind score | HKO 10-min wind, station-blended |
| `V` | Onshore wave score · height factor | HKO marine bulletin |
| `R` | River-mouth proximity (exponential decay, τ=8km) | Static catalogue of 18 river mouths |
| `H` | Historical accumulation prior (0–1) | Hand-tuned from cleanup reports |
| `E` | Exposure to open sea (0–1) | Hand-tuned per beach |
| `b` | Bay trap-factor (0–1) | Hand-tuned per beach |

Coefficients are not learned — they reflect physical intuition (wind
dominates surface debris transport, historical priors anchor against
unmeasured site-specific quirks). They are the obvious thing to
optimize against ground-truth observations once we have them; see §6.

### 2.1 Onshore wind score

For a station with wind from direction `θ_w` and a beach facing the
sea at orientation `θ_b`, the onshore component is:

```
onshore(θ_w, θ_b) = max(0, cos(|θ_w − θ_b|))
```

Each beach is associated with its 2 nearest HKO stations (mapping
hand-curated for the 39 "original" beaches and inherited via
3-nearest-neighbour distance-weighted assignment for the 47 added
from the hkcleanup.org coastal map). The wind score blends per-station
onshore × speed × max-speed-normalisation across that pair, plus a
gust bonus when gust − mean > 0.

### 2.2 Wind smoothing

Live wind alone overreacts to lulls. Predictions use an exponentially
decay-weighted integration of the last 72h of snapshots with an
18-hour half-life:

```
w(Δt) = exp(-Δt / τ),   τ = 18h / ln 2
```

Direction is averaged as vectors:

```
u̅ = Σᵢ wᵢ · sᵢ · sin(θᵢ),   v̅ = Σᵢ wᵢ · sᵢ · cos(θᵢ)
θ̅ = atan2(u̅, v̅),   s̅ = √(u̅² + v̅²)
```

so 350° + 10° collapses to North rather than 180°. Snapshots are
written to Firestore on a 6-hour Cloud Function schedule (`collectWind`).

A "recent storm boost" flag is raised when the smoothed onshore score
exceeds 1.3 × the current instantaneous score — this surfaces beaches
where a passing front already pushed debris in, even if conditions
have since calmed.

### 2.3 Wave and river components

Wave: HKO marine bulletin gives wave height and direction. Score is
`onshore(θ_wave, θ_b) · min(1, h/3)`. Capping at 3m prevents typhoon
heights from dominating.

River: simple exponential-decay sum of distance-weighted weights from
18 documented river mouths (Pearl River outflow, Shing Mun, Lam Tsuen,
Tin Shui Wai, etc.) with decay constant τ = 8 km. The river term is
exposure-gated like the wind/wave terms.

### 2.4 Bay multiplier

Empirically motivated: debris that drifts into a high-`b` bay
(Cheung Sha Lan, Hap Mun Bay) leaves much more slowly than from a
straight shoreline. We model this as a simple `(1 + 0.3·b)`
multiplier on the final score, applied *after* the exposure-gated
dynamics. `b` is a hand-tuned 0–1 indicator.

---

## 3. Data

| Source | Coverage | Cadence |
|---|---|---|
| HKO `latest_10min_wind.csv` | 30 stations across Hong Kong | 10 min |
| HKO marine bulletin (waveHeight, waveDirection, wavePeriod) | Aggregated near-Hong Kong | Hourly |
| Beach catalogue | 92 entries, bilingual EN/zh-HK | Static |
| hkcleanup.org Coastal Map markers | 94 markers (1 outlier rejected) | Static, refresh on demand |
| HandsOn HK volunteer opportunities | "Environmental Conservation" filter | Scraped per request, 1h cache |

Beach features are stored as JSON. Each row has `name`, `nameTc`,
`lat`, `lng`, `region`, `orientation` (deg), `exposure`, `bayFactor`,
`historicalWeight`, `nearestStations` (array of HKO names),
`accessDifficulty` (1–5), `roadTier` ∈ {road, ferry, kaito, remote},
`hikeGrade` ∈ {flat, rolling, steep, scramble}, and a parsed `debris`
object (cleaning frequency, transport notes, age suitability, coastal
length — sourced from hkcleanup's site descriptions).

---

## 4. Beach catalogue construction

Two principled passes:

1. **Anchor on hkcleanup.org Coastal Map** — 93 surviving markers
   used as the canonical site list with their coordinates. Matched
   against an existing hand-tuned catalogue by Chinese name (most
   reliable), then English name. Proximity matching was deliberately
   excluded after it caused silent identity merges between adjacent
   beaches (Kwun Yam ↔ Cheung Chau Tung Wan, both at ~250m apart).
2. **Add 7 hotspots not on the canonical map but documented in
   cleanup literature** — Po Chu Tam, Sandy Bay, Cheung Sha Lan
   (corrected coordinates after spotting a Discovery Bay vs South
   Lantau mix-up in the source data), Sam Pak Wan, Lo Tik Wan, Mui
   Wo, Chek Keng, Peng Chau Tung Wan.

For matched beaches, engine parameters are inherited verbatim. For
the 47 new beaches, engine parameters are derived from the 3 nearest
tuned neighbours, distance-weighted:

- `orientation`: unit-vector average of neighbour orientations.
- `exposure`, `bayFactor`: weighted scalar average.
- `nearestStations`: top-2 most-cited neighbour stations.
- `accessDifficulty`, `roadTier`, `hikeGrade`: parsed from the
  hkcleanup description blob when present (Low/Middle/High maps to
  1/3/4, with bumps for "remote" transport).

This is best-effort and explicitly flagged as a limitation — a beach
that genuinely faces an opposite aspect than its neighbours will be
mispredicted until tuned by hand.

---

## 5. System and engineering

- **Stack:** Node.js (Express) backend, React + Leaflet frontend,
  Firebase Hosting + Cloud Run (us-central1), Firestore for wind
  history. Scheduled Cloud Function pulls wind snapshots every 6h.
- **Lines of code:** ~3k server, ~3k client, ~700 in build scripts.
- **Cost:** Currently within Firebase free tier. Cloud Run scales to
  zero between requests; cold-start latency on the first hit of the
  day is ~3s.
- **Bilingual:** English / Traditional Chinese throughout. Map tile
  layer is language-aware (CARTO Voyager for EN labels, standard OSM
  for the Chinese-first HK `name` tags).
- **Other features:** integration with HandsOn HK's environment
  category as a public cleanup feed (Plastic Free Seas, Green Power,
  Soap Cycling); cleanup hosting flow with auto-deduplication against
  upcoming HandsOn events at the same beach; recycling drop-off map
  for the 130 GREEN@COMMUNITY stations.

---

## 6. Limitations and the questions I'd most value your input on

### Validation

The most glaring gap is the absence of any quantitative validation.
We've sanity-checked outputs against known hotspots (Cheung Sha Lan,
Pak Nai, Tai Long Sai Wan stay flagged in onshore-wind regimes), but
there's no formal evaluation against measured debris loads.

Plastic Free Seas have site-specific cleanup quantification —
kilograms collected, item types — for several PFS-managed sites.
The natural next step is to align that record with daily predicted
indices over the same period and compute (a) Pearson / Spearman
correlation, (b) AUC against a discretised "high-debris-day"
threshold, (c) lead-time analysis (does predicted "high" yesterday
predict observed "high" today?).

**Question 1:** Given the small N and irregular temporal spacing of
cleanup events, what would you use for a defensible validation
framework? Spatial cross-validation (leave-one-beach-out)? Bootstrap
on event-day records?

### Coefficient identifiability

Currently the 0.45/0.15/0.15/0.25 split is hand-set. Three
identifiability concerns:

- Wind and wave directions are highly collinear in HK (both forced
  by the prevailing monsoon).
- The historical prior `H` is itself derived from documented debris
  reports, which probably correlate with the dynamic terms via
  unobserved confounders (e.g. all the same beaches are wind-exposed
  *and* historically dirty).
- Exposure `E` gates the dynamic component multiplicatively — if you
  set `E=0` everything but `H` zeroes out.

**Question 2:** Given a small validation set, would a Bayesian
hierarchical model (partial pooling across beaches within region) be
overfit relative to the data, or is it the right move to identify
the wind/wave contributions separately? Any priors you'd recommend?

### Surface drift physics

The cosine-of-direction-difference is a crude proxy for surface
transport. A more principled approach would couple to a HF radar or
HYCOM-derived surface current product near HK waters. The fetch
distance also matters more than direction at low wind speeds.

**Question 3:** Is there a "good enough" public-domain surface
current product for the South China Sea margin that would be
practical to integrate without becoming a research project in
itself? Or is the lift not worth it for a marginal accuracy gain?

### Spatial coverage of wind stations

The 30 HKO stations cluster near Victoria Harbour and the airport.
Remote shorelines (Tai Long Sai Wan, Po Chu Tam) are paired with the
closest 1–2 stations, but those stations are 8–15 km away with
intervening topography. Idealised numerical mesoscale wind (WRF,
~1 km resolution over HK) exists but the licensing path through HKO
is unclear.

**Question 4:** When the closest measurement is meaningfully
mismatched in topographic regime, is it more honest to (a) refuse to
score the beach, (b) widen the uncertainty band on its score, or (c)
fall through to historical priors only?

---

## 7. What I'd hope to get from a conversation

The system is in production but the predictive science is the
weakest part. I'd value (in rough priority order):

1. Methodological guidance on validating without a clean labelled
   dataset.
2. Pointers to similar work in your group or community — predictive
   beach-condition models that have been deployed to the public, and
   what worked / didn't in terms of communicating uncertainty to lay
   users.
3. Honest scepticism on whether the model architecture is even the
   right shape for the problem, vs. a different formulation (e.g.
   Lagrangian particle tracking starting from river mouths and
   monsoon trade winds).
4. If there's a Stanford research thread this could plausibly
   connect to as undergrad/master's-level work — anything in your
   group on marine debris prediction or even non-debris coastal
   forecasting where the methodology transfers.

The code, data, and historic predictions are open and available on
request. Happy to share a runbook for reproducing the model offline.
