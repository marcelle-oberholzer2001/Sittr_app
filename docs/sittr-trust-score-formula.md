# Sittr Trust Score — Formula Specification

## Overview

The Trust Score is a 0–100 number shown on every sitter's profile and search result card. It combines five weighted components so that no single factor (like one lucky 5-star review) can dominate, and so sitters can see exactly what to improve.

**Design principles:**
- Transparent — a sitter can see their own breakdown by component, not just the final number
- Resistant to gaming — a brand-new sitter with one 5-star review should not outrank an experienced sitter with fifty 4.9-star reviews
- Recency-aware — recent behavior counts more than behavior from years ago
- Verification-gated — a sitter can't appear in search at all without baseline verification (ID + criminal check + address), regardless of score

---

## The five components

| Component | Weight | What it measures |
|---|---|---|
| Review quality | 30% | Bayesian-weighted average rating |
| Reliability | 25% | Acceptance rate, cancellation rate, response time |
| Verification & certifications | 20% | Baseline checks plus optional certifications |
| Experience | 15% | Completed bookings, tenure, log-scaled |
| Repeat clients | 10% | % of owners who rebook the same sitter |

**Trust Score = (0.30 × Review) + (0.25 × Reliability) + (0.20 × Verification) + (0.15 × Experience) + (0.10 × Repeat)**

Each component is calculated on its own 0–100 scale before weighting.

---

## 1. Review quality (30%) — Bayesian-weighted average

A simple star average punishes experienced sitters unfairly and rewards brand-new sitters with a single good review. Instead, use a Bayesian average that pulls a sitter's score toward the platform-wide average until they've built up enough reviews of their own.

```
Review Score = ( (v / (v + m)) × R + (m / (v + m)) × C ) × 20
```

- **R** = the sitter's own average star rating (1–5)
- **v** = number of reviews the sitter has received
- **m** = minimum review threshold before a sitter's own average is fully trusted (recommend **m = 10**)
- **C** = platform-wide average star rating across all sitters (recompute periodically, e.g. weekly)
- **× 20** converts a 1–5 star scale to a 0–100 score

**Example:** Platform average (C) = 4.6. A sitter with only 2 reviews averaging 5.0 stars scores much closer to 4.6 than 5.0 — they haven't proven consistency yet. A sitter with 40 reviews averaging 4.9 scores very close to 4.9, since they've clearly demonstrated it.

**Recency weighting (recommended):** weight reviews from the last 6 months at 1.5x, and reviews older than 18 months at 0.5x, before computing R. This rewards sitters who are currently doing good work over sitters coasting on old reviews.

---

## 2. Reliability (25%)

```
Reliability Score = (0.40 × Acceptance Rate)
                   + (0.35 × (100 − Cancellation Penalty))
                   + (0.25 × Response Time Score)
```

- **Acceptance rate** = % of received requests accepted or properly declined (not ignored). Ignored requests hurt this; declines with a stated reason (e.g. fully booked) do not.
- **Cancellation penalty** = weighted count of sitter-initiated cancellations, heavily penalized (a cancellation is worse than a decline, since it breaks a commitment already made). Suggested: −15 points per cancellation within the last 12 months, floor at 0.
- **Response time score** = normalized against response time in minutes, e.g. under 15 min = 100, 15–60 min = 80, 1–6 hrs = 60, 6–24 hrs = 30, over 24 hrs = 0.

**SOS bookings should not count against reliability** if the sitter used the SOS system correctly — that's the entire point of building it as a legitimate escape hatch rather than a silent cancellation. **Specifically: the cancellation penalty counter above must exclude any incompletion that was triggered via the SOS flow.** Only sitter-initiated abandonment without going through SOS should count as a cancellation for this formula.

---

## 3. Verification & certifications (20%)

Baseline verification (ID + proof of address) is a **gate** — a sitter without it cannot be active on the platform at all. **The criminal background check is optional**, not part of the gate — a sitter can go live without one, but it's the single largest scoring item in this component, plus it unlocks a visible "Background Checked" badge on her profile:

| Item | Points |
|---|---|
| Baseline verified (ID + address) | 30 (floor, required to be active) |
| Criminal background check (HURU) | +30 |
| Pet Sitter Institute of SA certification | +15 |
| Pet First Aid certified | +10 |
| Transport verified (license on file) | +15 |
| Introduction video uploaded | +10 |

Capped at 100. A sitter with only the baseline (no criminal check, no certs) scores 30 here — a meaningfully lower Verification score, which pulls down her overall Trust Score and her search ranking, without excluding her from search entirely. This is the actual mechanism that replaces "mandatory" — an unchecked sitter isn't blocked, she's just visibly and mathematically less trusted, and shows up lower and without the badge. **Whether that's enough to satisfy the trust promise that validated this idea originally is worth revisiting once real usage data exists** — if most owners only book badge-holders anyway, the optional model may functionally behave like a mandatory one; if they don't, the platform's core safety promise is weaker than what people initially responded to.

---

## 4. Experience (15%) — log-scaled

Raw booking counts should NOT be scored linearly, or a sitter with 500 bookings would permanently dominate over one with 60 great ones. Use a log scale so early bookings matter most and the curve flattens out:

```
Experience Score = MIN(100, 30 × LOG10(completed_bookings + 1) + 5 × years_on_platform)
```

This means going from 0 → 10 bookings matters a lot more to the score than going from 200 → 210 — which is the right incentive, since it rewards sitters for *getting started* rather than only rewarding those who've been on the platform the longest.

---

## 5. Repeat clients (10%)

```
Repeat Score = MIN(100, (repeat_bookings / total_unique_owners_booked) × 100)
```

This is arguably your best trust signal and the hardest to fake — an owner rebooking the same sitter is a much stronger vote of confidence than a star rating, since it's a real decision made with real money, not just a favor. **The MIN(100, ...) cap matters**: without it, one owner rebooking the same sitter many times (e.g. a regular weekly dog walk) can push repeat_bookings above total_unique_owners_booked, producing a score over 100 — a real bug in the original formula, now fixed.

---

## Notes for implementation

- Recompute scores nightly, not in real time — avoids score jitter after every single event and is much cheaper computationally.
- Store each component's raw sub-score alongside the final number, so the sitter-facing "why is my score X" breakdown screen doesn't need to recompute anything live.
- New sitters with fewer than `m` (10) reviews will have noticeably lower scores until they build history — this is intentional, not a bug. Consider a "New sitter" badge instead of a low score badge for the first 90 days, so new sitters aren't unfairly stigmatized while the score catches up.
