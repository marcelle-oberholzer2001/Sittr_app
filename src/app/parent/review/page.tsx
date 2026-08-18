"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const TAGS = ["Great communication", "On time", "Extra caring", "Great photos/updates"];

function OwnerReviewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  const [loading, setLoading] = useState(true);
  const [sitterId, setSitterId] = useState<string | null>(null);
  const [sitterName, setSitterName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>(["Great communication", "On time"]);
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
        .select("sitter_id, service_type, date_from, date_to, status")
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking || booking.status !== "completed") {
        setLoading(false);
        setNotFound(true);
        return;
      }

      const { data: sitter } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", booking.sitter_id)
        .single();

      setSitterId(booking.sitter_id);
      setSitterName(sitter?.full_name || "your sitter");
      setServiceType(booking.service_type);
      const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
      setDateRange(
        `${new Date(booking.date_from).toLocaleDateString("en-ZA", opts)}–${new Date(
          booking.date_to,
        ).toLocaleDateString("en-ZA", opts)}`,
      );
      setLoading(false);
    })();
  }, [bookingId]);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit() {
    if (!bookingId || !sitterId) return;
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
      reviewee_id: sitterId,
      is_public: true,
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
          Thanks for letting other owners know how it went with {sitterName}.
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
          <h1 className="font-serif text-xl font-semibold text-ink">How was {sitterName}?</h1>
          <p className="text-xs text-muted">
            {serviceType} · {dateRange}
          </p>
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
          className="w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit review"}
        </button>
      </div>
    </div>
  );
}

export default function OwnerReviewPage() {
  return (
    <Suspense>
      <OwnerReviewForm />
    </Suspense>
  );
}
