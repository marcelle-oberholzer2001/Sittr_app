# Sittr — Product Specification (v2, fully current)

*A trusted pet-sitting marketplace for South Africa. This document is self-contained — written as if you're picking this up for the first time, even though development has already started. It's the current source of truth; if anything in an older file conflicts with this, this one wins. Written to be handed to a developer, and to work as a prompt for Claude — paste this whole document in and say what you want to build or fix next.*

---

## 1. The core idea

Facebook groups are still where most South Africans find pet sitters — not because people love it, but because existing paid platforms have high commissions (20–40%), hidden fees, weak vetting, and unreliable notifications. Sittr's bet: become the trusted, transparent alternative by fixing exactly those complaints, for all three parties — platform, sitters, and owners.

**A person can be both an owner and a sitter on one account.** This isn't two separate products; it's one identity with two roles.

---

## 2. MVP vs Full Vision

**MVP (build/finish first):**
- Splash + role selection + signup
- Sitter onboarding: coverage area (named suburbs, searched and added — not a map/radius), personal details, verification (ID + HURU criminal check), services & pricing, per-service pet preferences, bank details
- Owner onboarding: skip-to-browse quick start, pet passport, ID verification
- Search & matching (suburb-based location + dates + service type)
- Sitter profile page
- Booking flow: request → accept/decline → review & sign agreement → pay in full → confirm
- Basic chat
- Sit Clipboard (auto-filled from Pet Passport + owner's home details, plus a meet & greet checklist and an accumulating notes log per pet parent)
- Cancellation policy (72-hour rule)
- Reviews (both directions)
- Payouts (single release, 2 days post-sit)

**Phase 2:**
- Referral system + referral rewards
- Live update checklist + care timeline (scheduled during-sit prompts and photo log — separate from the Sit Clipboard reference doc, which is now MVP)
- SOS backup-sitter flow
- Full Trust Score formula (MVP can launch with a simpler star rating only)
- Loyalty/repeat-client discounts for owners
- Home dashboard as a unified feed
- Add to favourites, share profile via WhatsApp
- Languages spoken, additional pet types (horses, fish)
- Dog walking duration tiers (30 / 60 min)
- The fun species/skill badges (Cat Specialist, Horses, Exotic Pets, Puppy Experience, Medication Experienced)

**Later / explicitly out of scope for now:**
- Training academy / Pet Sitter Institute of SA certification marketplace
- GPS check-in/check-out
- AI matching
- Smart price suggestions
- Holiday waitlist
- Expansion into groomers, trainers, mobile vets, pet insurance, rescue/shelter donation program

---

## 3. Brand

- **Name:** Sittr
- **Colors:** Deep forest green (`#2C4A3E`) primary, terracotta/clay (`#C77A4E`) accent, warm off-white (`#F7F5F1`) background, muted gold (`#D9A441`) for star ratings only
- **Typography:** Fraunces (serif) for headings/wordmark, Manrope (sans) for UI and body text
- **Logo:** Not finalized — three live candidates: (1) a paw print where the pad is shaped like a house, which would double as both the static logo and the splash-loading animation; (2) a key mark with a house-shaped bow; (3) a dog-and-cat silhouette forming the paw pad together. Don't build final app-icon or website assets assuming any one of these yet.

---

## 4. Onboarding

### Splash screen
Paw icon (or whichever logo direction is chosen) with parts lighting up sequentially as a loading animation.

### Role selection
"I need a sitter" / "I want to sit" — framed as which view to start in, not a permanent choice. Most people end up doing both, switchable anytime.

### Sitter onboarding (full flow — required before going live)

1. **Coverage area — map + draggable radius**, not a suburb list. Sitter sets a center point (her general area, not exact address) and drags a radius slider (e.g. 2–20km) to define how far she'll travel. No suburb boundary data needed — matching is a simple distance calculation between her center point and an owner's search location. **No travel fees are charged** — a sitter only appears for searches inside her chosen radius.
2. **Home address** — private, KYC-only, never shown publicly (distinct from the general-area center point used for matching, which is intentionally less precise).
3. **Personal details** — full legal name, DOB (hard 18+ gate, no exceptions), sex as on ID, profile + gallery photos.
4. **Work schedule** — single-select: 9–5 office / remote / part-time / student / shift work / not working / retired.
5. **Transport & emergency** — has own transport (Y/N) + license upload if yes; backup driver toggle + emergency contact if no.
6. **Verification** — an ID document is **required (a hard gate)** before a sitter is active/searchable at all. Proof of address was originally also required but was dropped to reduce signup friction, since coverage matching no longer relies on a home address anyway (see Section 4, coverage area). **The criminal background check (HURU) is optional**, not a gate — a sitter can go live without one, but passing it earns a visible "Background Checked" badge and a significant Trust Score boost (it's the single largest item in the Verification component of the formula). Standard HURU results often return same-day (R280–480 depending on speed tier) at 500+ PostNet/Jetline locations. ⚠️ **This was changed from an earlier mandatory design specifically to reduce sitter signup friction — worth knowing this trades away some of the "everyone here is vetted" promise that originally validated the idea in market feedback. Revisit once real usage data shows whether owners actually filter for the badge or book unchecked sitters anyway.**
7. **Services & rates** — sitter turns on only the services she offers, each with its own price:
   - 1x daily visit (per visit)
   - 2x daily visits (per day)
   - Daytime pet sit (per day)
   - Overnight / sleepover (per night)
   - Dog walking (per walk) — **should be split into duration tiers (30 min / 60 min), not built yet**
   - Boarding at sitter's home (per night)
   - Doggy daycare (per day)
   
   Selecting **Boarding** or **Daycare** triggers an additional conditional step:
8. **Home screening** (only if Boarding/Daycare selected) — other pets in home, other people in home, fenced yard, indoor smoking, photos of the space.
9. **Pet preferences — set per service, not globally.** A sitter might only board small/medium dogs due to home space, but be fully comfortable walking or visiting a large dog at the owner's home. Each active service gets its own size/species chips and an optional breed-exclusion field. Boarding/Daycare cards are framed as "limited by your space"; at-owner's-home services are framed as "handling comfort," typically more permissive. Leaving a breed field blank signals openness to breeds many sitters turn away (e.g. bulldogs). Current species taxonomy covers dogs (by size), cats, birds, reptiles, rabbits/small mammals — **horses and fish are not yet included, worth deciding if in scope.**
10. **Bank account details** — holder name, bank, account number, branch code, for payouts. Verified against the sitter's ID before her first payout.

**Not yet in onboarding at all:** references, languages spoken. Both were flagged twice independently during design and never actually built — worth prioritizing.

### Owner onboarding (deliberately low-friction)
1. **Quick start** — location, optional dates, pet type. A "Skip" option skips even that.
2. Owner browses freely.
3. **Only when they tap "Request booking"** does a checklist bottom-sheet appear (pet passport, ID verification, payment method) — each a quick tappable mini-form. The request can't send until all three are done.

**Pet Passport:** photo, name, species, size, breed, age, personality tags, feeding schedule, medication, allergies, walking routine, behaviour notes, vet name/number/address. Never needs to be retyped — flows straight into every future Sit Clipboard.

**Owner verification is lighter than sitter's** — ID only, no criminal check — since sitters are unsupervised in someone's home; owners aren't in the same position. State this asymmetry to the user, not silently.

**Not yet built for owners:** address, additional emergency contact fields beyond what's needed for booking.

---

## 5. Search & matching

Owner searches by **location + dates + specific service type**. A sitter only appears if:
1. The search location falls inside her coverage radius (distance calculation from her center point, not a suburb-list lookup)
2. That specific service is turned on, with matching per-service pet preferences (size/species/breed)
3. Her availability calendar shows those dates as free

**Known gap:** the availability calendar currently blocks by *date*, not *time of day* — fine for overnight/boarding (the whole day is genuinely occupied) but potentially too aggressive for short visits/walks, where a sitter could plausibly take multiple bookings in one day. Needs a decision before this is finished.

---

## 6. Booking lifecycle

1. **Request sent** → sitter gets full detail (pet basics from passport, dates, location, her own earnings for this specific service).
2. **Sitter responds:** Accept / Refer someone (search restricted to verified sitters covering that area — **open question: unresolved if the referred sitter's rate differs from the original request**) / Decline (no rating penalty; only ignoring a request hurts acceptance rate).
3. **On acceptance** → owner reviews and signs the auto-generated booking agreement, then **pays the full amount in one payment** — not a deposit. Funds are held securely, not given to the sitter yet.
4. **"Arrange meet & greet" button** → opens a chat thread for both parties to coordinate logistics themselves.
5. **Cancellation policy:**
   - More than **72 hours** before the sit starts: free cancellation, **full refund of the entire amount paid**.
   - Within 72 hours: **50% of the sitting fee** goes to the sitter as compensation; the other 50% is refunded to the owner. **Whether the platform's commission is refunded or kept either way is not yet formally decided** — currently assumed kept, not confirmed.
   - **Known gap:** if the meet & greet (which happens after payment) goes badly and the owner cancels within the 72-hour window, she's charged the cancellation fee for what is arguably a legitimate safety decision. Worth a specific exception.
6. **Digital contract** — auto-generates per booking from data already on file: parties, pet & service, full fee breakdown, the cancellation policy in plain numbers, the emergency plan (vet details from the pet passport, SOS availability), and a liability clause. Owner explicitly reviews and signs (checkbox + typed name) before payment; the sitter's agreement is folded into her "Accept & agree" action. **A lawyer still needs to review the liability wording and whether tap-to-agree is sufficient for a waiver under South African law.**

---

## 7. During the sit

**Sit Clipboard** — persistent reference screen for the sitter, auto-populated from the Pet Passport and unlocked home details (wifi password, gate code, bin day). Sitter adds checkmarks confirming things discussed at the meet & greet, plus free-text notes.

**Live updates** — scheduled notifications timed to the pet's actual routine open a quick tap-to-complete checklist, optional photo. Posts a structured card into the chat and saves to a scrollable, downloadable **Care Timeline**. Gaps show visibly. **Consider adding a "supplies running low" alert type** (e.g. dog food running out mid-sit — a real scenario raised early on and never built).

---

## 8. SOS backup-sitter flow

1. Sitter selects a reason and triggers SOS from within the active booking.
2. Owner is notified immediately with a live status tracker — nothing happens without her approval.
3. Nearby verified sitters (matched on area, pet comfort, current availability) get an urgent alert with a short response window.
4. Owner approves the specific responder before any handoff occurs.
5. **Instant handoff** — full access to the Sit Clipboard, care timeline so far, and home access. No meet & greet required.
6. **Payment:** the backup sitter receives whatever the original sitter would have earned for the *remaining, unfinished* time — not their own listed rate. Platform commission still applies to that amount.
7. **SOS-triggered incompletions must not count against the original sitter's reliability/cancellation score** — this is the entire point of building SOS as a legitimate escape hatch.

---

## 9. Trust Score

A 0–100 weighted score, recalculated nightly, fully explainable to sitters via a breakdown screen. Full formula and a working spreadsheet calculator: `sittr-trust-score-formula.md` and `sittr-trust-score-calculator.xlsx`.

Five components: Review quality (30%, Bayesian-weighted so new sitters with 1 perfect review don't outrank consistent veterans), Reliability (25%, acceptance rate + cancellations + response time — SOS handoffs explicitly excluded from the cancellation count), Verification & certifications (20%), Experience (15%, log-scaled so early bookings matter most), Repeat clients (10%, capped at 100 — an earlier version of this formula had no cap and could mathematically exceed 100, now fixed).

---

## 10. Reviews

Bidirectional. Owners rate sitters (public, feeds Trust Score). **Sitters also rate owners — currently private**, feeding an internal reliability record only, not shown publicly. This was a judgment call, not a certainty — confirm you both actually want it that way.

---

## 11. Commission & Payments

**Commission: flat 10% from both sides.** (An earlier asymmetric 5%/15% model was explored and modeled — same total platform revenue either way, since 5+15 and 10+10 both equal 20% of the sitting fee combined — but the founder's decision is a flat, simpler-to-explain 10/10.)

**Worked example on a R600 sitting fee:**
- Sitter's net payout: R600 − 10% = **R540**
- Owner's platform fee: 10% of R600 = **R60**
- Owner's total charge: R600 + R60 = **R660**
- Total platform revenue on this booking: **R120**

⚠️ **Important — not yet propagated:** the existing mockups (booking flow, cancellation policy, booking agreement, payouts screen) still show dollar amounts calculated under the earlier 5%/15% model (e.g. a R690 total / R570 sitter net on this same R600 booking). These need to be updated to the numbers above before they're consistent with this decision — flagging clearly so this doesn't become the same kind of stale-numbers problem an earlier audit already caught once.

**Minimum fee floor:** proposed **R20 minimum platform fee per booking** if the percentage-based commission would calculate to less — still needs final confirmation against real Paystack fee figures.

**Payment model — single full payment, not a deposit:**
- Owner pays the full amount once, at booking confirmation — held securely.
- Sitter is paid the full net amount once, released **2 days after the sit ends**, if nothing's disputed. (Chosen specifically to avoid stacking two sets of Paystack fees per booking.)
- ⚠️ Still open: whether the 2-day release is instant at that mark or has a further clearing window, and what exact timestamp it's anchored to.
- ⚠️ Still open: who absorbs the gateway's non-refundable fee on a free (>72h) cancellation.

**Sitter payouts require bank account details** — collected at Step 10 of onboarding (see Section 4), verified against ID before first payout.

---

## 12. Open decisions — not design work, but block launch

- **Payment gateway** — ✅ resolved: Paystack. Confirm the real current SA fee rate from the dashboard before finalizing the R20 minimum fee floor.
- **Background check provider** — ✅ resolved: HURU.
- **Commission dollar-figure consistency** — ⚠️ new action item: update all mockups/spreadsheets to reflect the 10/10 flat decision (see Section 11).
- **POPIA compliance** — you will be storing ID documents and criminal-record results, "special personal information" under South African law with stricter requirements than ordinary data. Needs its own explicit legal review.
- **Legal/compliance** — ToS, the booking agreement's liability clause, VAT registration timing (R1m/year threshold), and whether holding owner funds before sitter payout triggers financial regulatory (escrow/client-funds) obligations.
- **Admin/back-office tooling** — verification approval, dispute handling, payout release all imply internal tooling not yet scoped, even for MVP.

---

## 13. Notifications — designed nowhere yet

One of the **four original founding complaints**, and still the only one with zero design work. Needs: delivery channel decision (push / WhatsApp / SMS / mix), a preferences screen, and a defined trigger list (booking accepted, payment received, meet & greet reminder, live-update reminders, SOS alert, payout released, review received, etc.). Equal priority to anything already mocked up.

## 14. Dispute flow — designed nowhere yet

The 2-day payout hold exists specifically to allow disputes to surface, but there's no actual dispute mechanism yet. Minimum for MVP: a "Report an issue" action on a completed booking within the hold window, which pauses the pending payout, plus a defined (even manual, human-reviewed) internal resolution process.

## 15. Edge cases needing an explicit answer

- **Sitter accepts, owner never pays** — her calendar dates lock on acceptance regardless; needs a payment deadline (e.g. 24h) with auto-release.
- **Sitter cancels before the sit starts** — the 72-hour policy as designed only covers owner-initiated cancellation; the sitter-side consequence beyond the −15 trust points isn't decided.
- **Owner cancels mid-sit** (comes home early, emergency) — no policy exists yet.
- **Meet & greet falls inside the 72-hour window** — see Section 6.
- **Vet bill authorization during a sit** — the agreement names the vet but not who authorizes/pays for treatment. Probably the single most likely real dispute.
- **Off-platform leakage** — once two people have met once through the platform, nothing stops them arranging future bookings directly and skipping commission. The classic two-sided marketplace failure mode.
- **Same-day multiple bookings** — tied to the date-vs-time-of-day calendar gap in Section 5.
- **Simultaneous requests** — two owners requesting the same sitter for overlapping dates before either has paid.

---

## 16. Attached files

- `sittr-trust-score-formula.md` / `sittr-trust-score-calculator.xlsx` — Trust Score math and working calculator
- `sittr-commission-model.xlsx` — commission scenarios (⚠️ built around the earlier 5/15 model, needs updating to flat 10/10)
- `sittr-booking-agreement.html` — the auto-generated per-booking contract
- `sittr-coverage-map-radius.html` — the map + radius coverage picker for onboarding Step 1
- `sittr-brain-mush-updated.md` — the original founder brainstorm, annotated against everything decided since
- A full set of HTML mockups covering every screen described above — interactive, open in any browser
- `sittr-marketing-schedule.md` / `sittr-marketing-kickoff-prompt.md` — the 8-week pre-launch and launch marketing plan

## 17. Changelog

Latest update: **Sit Clipboard moved from Phase 2 into MVP** (Section 2) — Marcelle decided the pet/home-details reference doc and per-parent meet & greet notes log matter enough to build now, rather than after launch. The live-update checklist and care timeline (scheduled during-sit photo prompts) remain Phase 2 — those are a separate feature from the Sit Clipboard itself. Also corrected two other stale spots caught in the same pass: coverage area is now suburb-based, not map + radius (Section 2 MVP list — Section 4 already reflected this, the summary list didn't); and proof of address was dropped from sitter verification (Section 4) after being cut for signup friction, no longer a hard gate alongside the ID document.

Earlier update: **criminal background check changed from mandatory to optional** (Section 4) — now earns a badge and a Trust Score boost rather than gating search visibility, done to reduce sitter signup friction. ID remains mandatory. The Trust Score's Verification component (Section 9, and the formula/calculator files) was rebalanced to reflect this — baseline floor dropped from 40 to 30 points, with the criminal check itself now worth +30 as the single largest optional item. Marketing materials (brand guide, website brief) were corrected to stop claiming universal background checks, since that's no longer accurate.
