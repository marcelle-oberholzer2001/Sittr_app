import { supabase } from "./supabase/client";

// Implements docs/sittr-trust-score-formula.md.
//
// Two components are intentionally simplified versus the spec, both flagged
// there as needing infrastructure that doesn't exist yet:
// - Verification (20%): only the baseline ID check is real data today.
//   Background checks, certifications, and intro video all stay at 0 until
//   an admin review system exists to actually confirm them for real.
// - Reliability (25%): the "sitter-initiated cancellation" penalty is
//   always 0, because the app has no sitter-cancellation flow yet (the
//   product spec itself says that policy isn't decided). Acceptance rate
//   and response time are fully real.

export interface TrustScoreBreakdown {
  total: number;
  review: number;
  reliability: number;
  verification: number;
  experience: number;
  repeat: number;
  reviewCount: number;
}

const REVIEW_WEIGHT = 0.3;
const RELIABILITY_WEIGHT = 0.25;
const VERIFICATION_WEIGHT = 0.2;
const EXPERIENCE_WEIGHT = 0.15;
const REPEAT_WEIGHT = 0.1;

const BAYESIAN_MIN_REVIEWS = 10;
const CONFIRMED_STATUSES = ["accepted", "agreed", "paid", "completed"];
const MS_PER_MONTH = 30 * 24 * 3600 * 1000;
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

interface ReviewRow {
  rating: number;
  created_at: string;
}

interface BookingRow {
  owner_id: string;
  status: string;
  created_at: string;
  responded_at: string | null;
}

function reviewScore(reviews: ReviewRow[], platformAvg: number, now: Date): number {
  if (reviews.length === 0) return platformAvg * 20;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of reviews) {
    const ageMonths = (now.getTime() - new Date(r.created_at).getTime()) / MS_PER_MONTH;
    const weight = ageMonths <= 6 ? 1.5 : ageMonths > 18 ? 0.5 : 1;
    weightedSum += r.rating * weight;
    weightTotal += weight;
  }
  const R = weightedSum / weightTotal;
  const v = reviews.length;
  const m = BAYESIAN_MIN_REVIEWS;

  return ((v / (v + m)) * R + (m / (v + m)) * platformAvg) * 20;
}

function reliabilityScore(bookings: BookingRow[]): number {
  // No bookings means no evidence either way -- assume average (matching
  // reviewScore's zero-data treatment), not a perfect, unearned 100.
  if (bookings.length === 0) return 60;

  const resolved = bookings.filter((b) => b.status !== "pending");
  const acceptanceRate = (resolved.length / bookings.length) * 100;

  const responseMinutes = resolved
    .filter((b): b is BookingRow & { responded_at: string } => b.responded_at !== null)
    .map((b) => (new Date(b.responded_at).getTime() - new Date(b.created_at).getTime()) / 60_000);

  let responseTimeScore = 100;
  if (responseMinutes.length > 0) {
    const avgMinutes = responseMinutes.reduce((sum, m) => sum + m, 0) / responseMinutes.length;
    responseTimeScore =
      avgMinutes < 15 ? 100 : avgMinutes <= 60 ? 80 : avgMinutes <= 360 ? 60 : avgMinutes <= 1440 ? 30 : 0;
  }

  // No sitter-cancellation flow exists yet, so this penalty never fires.
  const cancellationPenalty = 0;

  return 0.4 * acceptanceRate + 0.35 * (100 - cancellationPenalty) + 0.25 * responseTimeScore;
}

function verificationScore(idVerified: boolean): number {
  return idVerified ? 30 : 0;
}

function experienceScore(completedCount: number, profileCreatedAt: string, now: Date): number {
  const years = (now.getTime() - new Date(profileCreatedAt).getTime()) / MS_PER_YEAR;
  return Math.min(100, 30 * Math.log10(completedCount + 1) + 5 * years);
}

function repeatScore(bookings: BookingRow[]): number {
  const confirmed = bookings.filter((b) => CONFIRMED_STATUSES.includes(b.status));
  if (confirmed.length === 0) return 0;

  const countByOwner = new Map<string, number>();
  for (const b of confirmed) countByOwner.set(b.owner_id, (countByOwner.get(b.owner_id) ?? 0) + 1);

  const uniqueOwners = countByOwner.size;
  const repeatBookings = confirmed.length - uniqueOwners;
  return Math.min(100, (repeatBookings / uniqueOwners) * 100);
}

export async function computeTrustScores(sitterIds: string[]): Promise<Map<string, TrustScoreBreakdown>> {
  const result = new Map<string, TrustScoreBreakdown>();
  if (sitterIds.length === 0) return result;

  const now = new Date();

  const [profilesRes, platformReviewsRes, sitterReviewsRes, bookingsRes] = await Promise.all([
    supabase.from("profiles").select("id, id_verification_status, created_at").in("id", sitterIds),
    supabase.from("reviews").select("rating").eq("is_public", true),
    supabase
      .from("reviews")
      .select("reviewee_id, rating, created_at")
      .in("reviewee_id", sitterIds)
      .eq("is_public", true),
    supabase
      .from("bookings")
      .select("sitter_id, owner_id, status, created_at, responded_at")
      .in("sitter_id", sitterIds),
  ]);

  // With zero reviews anywhere on the platform, there's no real basis to
  // assume sitters are good -- default to the neutral midpoint of the 1-5
  // scale, not the maximum. Defaulting to 5 would hand every brand-new
  // sitter a perfect, unearned Review Quality score.
  const platformRatings = platformReviewsRes.data ?? [];
  const platformAvg =
    platformRatings.length > 0
      ? platformRatings.reduce((sum, r) => sum + r.rating, 0) / platformRatings.length
      : 3;

  const profilesById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

  const reviewsBySitter = new Map<string, ReviewRow[]>();
  for (const r of sitterReviewsRes.data ?? []) {
    const list = reviewsBySitter.get(r.reviewee_id) ?? [];
    list.push({ rating: r.rating, created_at: r.created_at });
    reviewsBySitter.set(r.reviewee_id, list);
  }

  const bookingsBySitter = new Map<string, BookingRow[]>();
  for (const b of bookingsRes.data ?? []) {
    const list = bookingsBySitter.get(b.sitter_id) ?? [];
    list.push({ owner_id: b.owner_id, status: b.status, created_at: b.created_at, responded_at: b.responded_at });
    bookingsBySitter.set(b.sitter_id, list);
  }

  for (const sitterId of sitterIds) {
    const profile = profilesById.get(sitterId);
    const reviews = reviewsBySitter.get(sitterId) ?? [];
    const bookings = bookingsBySitter.get(sitterId) ?? [];
    const completedCount = bookings.filter((b) => b.status === "completed").length;

    const review = reviewScore(reviews, platformAvg, now);
    const reliability = reliabilityScore(bookings);
    const verification = verificationScore(profile?.id_verification_status === "verified");
    const experience = profile ? experienceScore(completedCount, profile.created_at, now) : 0;
    const repeat = repeatScore(bookings);

    const total =
      REVIEW_WEIGHT * review +
      RELIABILITY_WEIGHT * reliability +
      VERIFICATION_WEIGHT * verification +
      EXPERIENCE_WEIGHT * experience +
      REPEAT_WEIGHT * repeat;

    result.set(sitterId, {
      total: Math.round(Math.max(0, Math.min(100, total))),
      review: Math.round(review),
      reliability: Math.round(reliability),
      verification: Math.round(verification),
      experience: Math.round(experience),
      repeat: Math.round(repeat),
      reviewCount: reviews.length,
    });
  }

  return result;
}
