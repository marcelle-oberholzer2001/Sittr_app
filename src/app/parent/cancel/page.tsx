"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchPetsByBooking, petNames, type BookingPet } from "@/lib/booking-pets";

const FREE_CANCEL_HOURS = 72;

interface BookingDetail {
  id: string;
  service_type: string;
  date_from: string;
  date_to: string;
  status: string;
  sitting_fee: number;
  platform_fee: number;
  total_paid: number;
  sitterName: string;
  pets: BookingPet[];
}

function formatDateRange(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const fromStr = new Date(from).toLocaleDateString("en-ZA", opts);
  const toStr = new Date(to).toLocaleDateString("en-ZA", opts);
  return `${fromStr} – ${toStr}`;
}

function CancelBookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error: fetchError } = await supabase
        .from("bookings")
        .select("id, sitter_id, service_type, date_from, date_to, status, sitting_fee, platform_fee, total_paid")
        .eq("id", bookingId)
        .single();

      if (fetchError || !data) {
        setLoading(false);
        return;
      }

      const [sitterRes, petsByBooking] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", data.sitter_id).single(),
        fetchPetsByBooking([data.id]),
      ]);

      setBooking({
        ...data,
        sitterName: sitterRes.data?.full_name || "your sitter",
        pets: petsByBooking.get(data.id) ?? [],
      });
      setLoading(false);
    })();
  }, [bookingId]);

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <p className="text-sm text-muted">Booking not found.</p>
      </div>
    );
  }

  if (booking.status === "cancelled") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
        <div className="mb-4 text-3xl">✓</div>
        <h1 className="mb-2 font-serif text-xl font-semibold text-ink">This booking is cancelled</h1>
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

  if (booking.status !== "paid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <p className="text-sm text-muted">
          This booking isn&apos;t confirmed yet, so there&apos;s nothing to cancel here.
        </p>
      </div>
    );
  }

  const hoursUntilSit = Math.max(0, (new Date(booking.date_from).getTime() - Date.now()) / 3_600_000);
  const daysUntilSit = Math.round(hoursUntilSit / 24);
  const countdownLabel =
    hoursUntilSit < 24 ? `${Math.round(hoursUntilSit)} hour${Math.round(hoursUntilSit) === 1 ? "" : "s"}` : `${daysUntilSit} day${daysUntilSit === 1 ? "" : "s"}`;
  const isFree = hoursUntilSit > FREE_CANCEL_HOURS;
  const sitterCompensation = isFree ? 0 : Math.round(booking.sitting_fee * 0.5 * 100) / 100;
  const ownerRefund = isFree ? booking.total_paid : Math.round(booking.sitting_fee * 0.5 * 100) / 100;

  async function handleCancel() {
    if (!booking) return;
    setCancelling(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    setCancelling(false);
    if (updateError) return setError(updateError.message);

    setCancelled(true);
  }

  if (cancelled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
        <div className="mb-4 text-3xl">✓</div>
        <h1 className="mb-2 font-serif text-xl font-semibold text-ink">Booking cancelled</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">
          R{ownerRefund} will be refunded to your payment method. {booking.sitterName} has been notified.
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
      <div className="px-5 pt-4">
        <h1 className="font-serif text-xl font-semibold text-ink">Cancel booking</h1>
        <p className="text-xs text-muted">
          {booking.service_type} with {booking.sitterName}
        </p>
      </div>

      <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-terracotta" />
        <div>
          <div className="font-serif text-sm font-semibold text-ink">{booking.sitterName}</div>
          <div className="mt-0.5 text-xs text-muted">
            {formatDateRange(booking.date_from, booking.date_to)} · {petNames(booking.pets)}
          </div>
        </div>
      </div>

      <div
        className={`mx-5 mt-4 rounded-2xl p-4 text-center ${isFree ? "bg-[#E4EEE9]" : "bg-[#F3E3D6]"}`}
      >
        <div className={`font-serif text-2xl font-semibold ${isFree ? "text-forest" : "text-terracotta"}`}>
          {countdownLabel}
        </div>
        <div className={`mt-0.5 text-xs font-bold ${isFree ? "text-forest" : "text-terracotta"}`}>
          until the sit starts
        </div>
      </div>

      <div className="mx-5 mt-3.5 overflow-hidden rounded-2xl border border-line bg-white">
        <div className={`flex gap-2.5 p-3.5 ${isFree ? "bg-[#F1EEE6]" : ""} border-b border-line`}>
          <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isFree ? "bg-forest" : "bg-line"}`} />
          <div className="flex-1">
            <h4 className="mb-0.5 text-sm font-bold text-ink">More than 72 hours before</h4>
            <p className="text-xs leading-relaxed text-muted">Free cancellation, full amount refunded.</p>
          </div>
          {isFree && (
            <span className="h-fit shrink-0 rounded-md bg-white px-2 py-1 text-[0.6rem] font-extrabold text-forest">
              YOU ARE HERE
            </span>
          )}
        </div>
        <div className={`flex gap-2.5 p-3.5 ${!isFree ? "bg-[#F1EEE6]" : ""}`}>
          <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${!isFree ? "bg-forest" : "bg-line"}`} />
          <div className="flex-1">
            <h4 className="mb-0.5 text-sm font-bold text-ink">Within 72 hours</h4>
            <p className="text-xs leading-relaxed text-muted">
              50% goes to the sitter as compensation — {booking.sitterName.split(" ")[0]} has likely turned
              down other bookings for this date. The rest is refunded to you.
            </p>
          </div>
          {!isFree && (
            <span className="h-fit shrink-0 rounded-md bg-white px-2 py-1 text-[0.6rem] font-extrabold text-forest">
              YOU ARE HERE
            </span>
          )}
        </div>
      </div>

      <div className="mx-5 mt-3.5 rounded-2xl border-[1.5px] border-dashed border-line bg-white p-3.5">
        <div className="flex justify-between py-1 text-sm">
          <span className="text-muted">Amount paid</span>
          <span className="font-bold text-ink">R{booking.total_paid}</span>
        </div>
        {!isFree && (
          <div className="flex justify-between py-1 text-sm">
            <span className="text-muted">Goes to {booking.sitterName} (compensation)</span>
            <span className="font-bold text-ink">R{sitterCompensation}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-line pt-2 text-sm font-extrabold">
          <span className="text-ink">{isFree ? "Refund if you cancel now" : "Your refund"}</span>
          <span className="text-ink">R{ownerRefund}</span>
        </div>
        {!isFree && (
          <p className="mt-2 text-[0.7rem] leading-relaxed text-muted italic">
            Note: whether the R{booking.platform_fee} platform fee is refunded here hasn&apos;t been
            formally decided yet — this is currently assumed non-refundable, not confirmed.
          </p>
        )}
      </div>

      {error && (
        <p className="mx-5 mt-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
          {error}
        </p>
      )}

      <div className="mx-5 mt-4">
        <button
          type="button"
          disabled={cancelling}
          onClick={handleCancel}
          className="w-full rounded-2xl border-[1.5px] border-terracotta py-4 text-sm font-bold text-terracotta disabled:opacity-50"
        >
          {cancelling
            ? "Cancelling…"
            : isFree
              ? "Cancel & get a full refund"
              : "Cancel anyway (partial refund)"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/parent/agreement")}
          className="mt-2.5 w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white"
        >
          Keep booking
        </button>
      </div>

      {!isFree && (
        <p className="mx-5 mt-4 text-center text-xs leading-relaxed text-muted">
          If you cancel, we&apos;ll help you request a different available sitter for the same dates — but{" "}
          {booking.sitterName}&apos;s compensation isn&apos;t recoverable.
        </p>
      )}
    </div>
  );
}

export default function CancelBookingPage() {
  return (
    <Suspense>
      <CancelBookingContent />
    </Suspense>
  );
}
