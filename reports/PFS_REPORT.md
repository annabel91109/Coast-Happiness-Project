# Coast Happiness Project — Report for Plastic Free Seas

**Live site:** https://coast-happiness-project.web.app
**Prepared:** May 2026

---

## What it is

Coast Happiness Project is a Hong Kong–wide trash prediction and cleanup
planning tool. The site does three things:

1. **Ranks 86 beaches and tracks 6 trash hotspots** every six hours based
   on current wind, recent storms, wave conditions, and known
   accumulation patterns — so volunteers can pick a beach where a
   cleanup will actually have impact.
2. **Lists upcoming public cleanups** from HandsOn HK, including the
   ones PFS runs at Pak Nai and Cheung Sha Lan, so the public can sign
   up directly.
3. **Walks individuals through hosting their own cleanup** — picks a
   beach, generates a transport + recycling drop-off + equipment
   checklist + safety brief plan, and exports a calendar event.

The whole thing is bilingual (English / Traditional Chinese) and
mobile-first.

---

## Why this matters for PFS

PFS already does the hard work — running the events at Pak Nai and
Cheung Sha Lan, coordinating Plastic Free Seas Foundation volunteers,
publishing through HandsOn HK. Coast Happiness sits *upstream* of
that, in two specific ways:

- **Pipeline.** Volunteers searching "where should I help today" land
  on a ranked list of beaches. The PFS-run cleanups show up directly
  on those beach cards, with a one-click sign-up link to HandsOn HK.
  Users who want to do *more* than turn up — who want to host their
  own event — are gently steered away from beaches where PFS already
  has something scheduled, so the effort spreads instead of
  duplicating.
- **Targeting.** Cheung Sha Lan and Pak Nai are well-known hotspots,
  but there are wilder spots (Po Chu Tam, Tai Long Sai Wan, Sha Lo
  Wan) that aren't on most volunteer maps. The trash predictor
  surfaces them when the wind happens to be driving debris their way,
  giving PFS a data-backed answer when planning the next quarter's
  programme.

The 6 "non-beach" hotspots in the system — Po Chu Tam, Sha Lo Wan,
Lung Ha Wan, Pak Shui Wun, Pak Sha Chau, Nam Fung Chau — are tracked
specifically because they're not swim beaches: they're the tidal
pools and rocky inlets the public never visits, but where plastic
piles up. That's PFS territory.

---

## How the predictions work

Each beach has a small set of hand-tuned geography parameters:

- **Orientation** — which compass direction the beach faces, so we
  can compute whether the current wind is blowing debris *onto* the
  shore or *away* from it.
- **Exposure (0–1)** — how open it is to the South China Sea.
  Repulse Bay is semi-sheltered (0.7), Po Chu Tam is wide open (0.95).
- **Bay factor (0–1)** — how trap-shaped the bay is. Cheung Sha Lan
  scores high because debris that drifts in doesn't easily leave.
- **Historical weight (0–1)** — a prior set from documented cleanup
  reports. PFS-published debris quantities from Cheung Sha Lan and
  Pak Nai feed directly into this term.

Every 6 hours we pull the latest wind readings from all 30 Hong Kong
Observatory stations, smooth them with an 18-hour-half-life decay
(so a Wednesday afternoon storm still influences Saturday's
prediction), pair each beach with its 2 nearest stations, and compute
an "onshore wind score". That score combines with wave direction
(from the HKO marine bulletin), river-mouth proximity (because river
runoff is a major debris source), and the historical prior. The
result is a 0–10 trash index per beach. A risk level is attached:
Low, Moderate, High, Very High.

We deliberately don't claim this is ground truth — see "limitations"
below.

---

## What's in the beach list

92 entries total, sourced from the hkcleanup.org Coastal Map (their
canonical site list, with their coordinates), plus 7 high-debris
hotspots not on that map but documented elsewhere — Po Chu Tam,
Sandy Bay, Cheung Sha Lan, Sam Pak Wan, Lo Tik Wan, Mui Wo, Chek
Keng, Peng Chau Tung Wan.

For each beach we also surface the cleaning frequency, transport
info, age suitability, and coastline length parsed from
hkcleanup's published descriptions. This means the host-a-cleanup
wizard can hand a volunteer realistic logistics ("Bus 9, 30-minute
walk, gentle") rather than generic advice.

| Region | Count |
|--------|------:|
| Sai Kung | 26 |
| Lantau | 21 |
| HK Island | 14 |
| Tsuen Wan | 8 |
| Tuen Mun | 7 |
| Lamma | 6 |
| Cheung Chau | 5 |
| Other (Tai Po, North, Sha Tin, Peng Chau) | 5 |

---

## Limitations to be upfront about

- **No empirical validation yet.** We've sanity-checked outputs
  against well-known accumulation patterns (Cheung Sha Lan stays
  consistently flagged), but we haven't run a formal validation
  against PFS's quantified cleanup records. This is the most
  obvious next step and the one PFS could most directly help with.
- **The 47 hkcleanup-only beaches** have engine parameters
  (orientation, exposure, station mapping) inherited from their
  nearest tuned neighbour rather than measured directly. Where the
  local coastline shape contradicts the neighbour, predictions drift.
- **Wind stations are sparse on remote shorelines.** Beaches like
  Tai Long Sai Wan are paired with Sai Kung and Tap Mun, which
  doesn't perfectly represent local wind.

---

## What we'd ask PFS for

1. **Cleanup quantification data** — even a coarse "kilograms
   collected at site X on date Y" log over the last year or two
   would let us validate which predictions match reality.
2. **Local knowledge on the 47 hkcleanup beaches** — a quick
   sanity-check on which way each one actually faces, and whether
   our coarse exposure / bay-factor estimates feel right for sites
   PFS has actually run cleanups at.
3. **Direct linking** from PFS's HandsOn HK opportunity pages back
   to Coast Happiness — so volunteers see "what's the wind doing at
   this beach tomorrow?" while deciding whether to register.

In return: an embeddable map widget showing PFS-organized cleanups
and live trash predictions, branded as PFS would prefer.

---

## Contact

Annabel — s2286943@ed.ac.uk
Repo + technical write-ups available on request.
