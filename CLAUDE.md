# Sittr — Project Context

## What this is
Sittr is a trusted pet-sitting marketplace app for South Africa, replacing informal Facebook groups by fixing what people actually complain about: no vetting, high commissions, hidden fees, unreliable notifications. Full product decisions are in `docs/product-spec.md` — read that file before building anything, it's the source of truth.

## Who's building this
I'm the founder, not a developer. I know basic HTML/CSS from building static sites, but this is my first real app project. I'm building this solo — explain things clearly, don't assume prior knowledge of frameworks, databases, or deployment. When something requires a judgment call, explain the trade-off simply rather than just picking one silently.

## Tech stack (decided)
- **Frontend + backend:** Next.js (one project, one framework, keeps things simple)
- **Database + auth:** Supabase (hosted Postgres, handles login/signup so we don't build auth from scratch)
- **Hosting:** Vercel, connected to this GitHub repo for automatic deploys
- **Payments (later, not yet):** Paystack

## Build order — important
Build in this order, low-risk first:
1. UI screens with fake/mock data — no real accounts, no real money, no real sensitive data yet
2. Real database connection (Supabase) once the UI works
3. Real authentication/login
4. Payments and anything touching real user money or ID/criminal-check documents — flag clearly and go slowly here, this needs extra care

Don't jump ahead to payments or sensitive data handling early just because it seems interesting — the plan is deliberately sequenced to build confidence on safe things first.

## Reference material
- `docs/product-spec.md` — full product specification, the source of truth for every feature and decision
- `docs/brand-guide.md` — colors, fonts, tone of voice
- `docs/mockups/` — interactive HTML mockups of every screen already designed. Use these as the actual visual reference when building the real screens — match them closely rather than inventing a different design
- `docs/trust-score-formula.md` — the trust score algorithm, only needed once we get that far

## Working style
- Explain what you're about to do before doing anything complex, in plain language
- After building something, tell me how to actually test it (what command to run, what URL to open)
- If you hit a decision that affects money, security, or user data, stop and explain the options rather than picking one and moving on
