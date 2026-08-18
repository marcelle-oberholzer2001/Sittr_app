"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchPetsByBooking, petNames } from "@/lib/booking-pets";

const TAGS = ["Accurate pet info", "Clear home instructions", "Easy to reach", "Home left tidy"];

function SitterReviewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  const [loading, setLoading] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [petName, setPetName] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>(["Accurate pet info", "Clear home instructions"]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    (async () => {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("owner_id, status")
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking || booking.status !== "completed") {
        setLoading(false);
        setNotFound(true);
        return;
      }

      const [ownerRes, petsByBooking] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", booking.owner_id).single(),
        fetchPetsByBooking([bookingId]),
      ]);

      setOwnerId(booking.owner_id);
      setOwnerName(ownerRes.data?.full_name || "this pet parent");
      setPetName(petNames(petsByBooking.get(bookingId) ?? []));
      setLoading(false);
    })();
  }, [bookingId]);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit() {
    if (!bookingId || !ownerId) return;
    setSubmitting(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setSubmitting(false);
      setError("You need to be logged in to leave a review.");
      return;
    }

    const { error: insertError } = await supabase.from("reviews").insert({
      booking_id: bookingId,
      reviewer_id: uid,
      reviewee_id: ownerId,
      is_public: false,
      rating,
      tags,
      comment: comment.trim() || null,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSubmitted(true);
  }

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <p className="text-sm text-muted">This booking isn&apos;t ready to review yet.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
        <div className="mb-4 text-3xl">✓</div>
        <h1 className="mb-2 font-serif text-xl font-semibold text-ink">Review submitted</h1>
        <p className="mb-6 text-sm text-muted">
          This only affects {ownerName}&apos;s private reliability record — thanks for the honest
          feedback.
        </p>
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="rounded-2xl bg-forest px-6 py-3.5 text-sm font-bold text-white"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper pb-8">
      <div className="flex items-center gap-3 px-5 pt-4">
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-sm"
        >
          ←
        </button>
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink">How was {ownerName}?</h1>
          <p className="text-xs text-muted">Owner of {petName}</p>
        </div>
      </div>

      <div className="my-5 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`text-4xl ${n <= rating ? "text-gold" : "text-line"}`}
          >
            ★
          </button>
        ))}
      </div>

      <div className="px-5">
        <label className="mb-2 block text-xs font-extrabold tracking-wide text-muted uppercase">
          What stood out?
        </label>
        <div className="mb-4 flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold ${
                tags.includes(tag) ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Anything else to add?"
          className="mb-4 w-full resize-none rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
        />

        {error && (
          <p className="mb-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="mb-4 w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit review"}
        </button>

        <p className="rounded-xl bg-[#F1EEE6] px-3.5 py-3 text-xs leading-relaxed text-muted">
          🔒 This review only affects {ownerName}&apos;s private reliability record — it isn&apos;t shown
          publicly, so owners can be reviewed honestly without it becoming a public callout.
        </p>
      </div>
    </div>
  );
}

export default function SitterReviewPage() {
  return (
    <Suspense>
      <SitterReviewForm />
    </Suspense>
  );
}
