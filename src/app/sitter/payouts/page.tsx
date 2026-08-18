"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchPetsByBooking, petNames } from "@/lib/booking-pets";

const HOLD_DAYS = 2;

interface PayoutRow {
  id: string;
  serviceType: string;
  dateFrom: string;
  dateTo: string;
  netPayout: number;
  petLabel: string;
  releaseDate: Date;
  released: boolean;
}

function formatDateRange(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const fromStr = new Date(from).toLocaleDateString("en-ZA", opts);
  const toStr = new Date(to).toLocaleDateString("en-ZA", opts);
  return `${fromStr} – ${toStr}`;
}

export default function PayoutsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }

      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, service_type, date_from, date_to, sitting_fee, status")
        .eq("sitter_id", uid)
        .in("status", ["paid", "completed"])
        .order("date_to", { ascending: false });

      if (!bookings || bookings.length === 0) {
        setLoading(false);
        return;
      }

      setCompletedCount(bookings.filter((b) => b.status === "completed").length);

      const petsByBooking = await fetchPetsByBooking(bookings.map((b) => b.id));
      const now = new Date();

      setRows(
        bookings.map((b) => {
          const releaseDate = new Date(b.date_to);
          releaseDate.setDate(releaseDate.getDate() + HOLD_DAYS);
          return {
            id: b.id,
            serviceType: b.service_type,
            dateFrom: b.date_from,
            dateTo: b.date_to,
            netPayout: Math.round(b.sitting_fee * 0.9 * 100) / 100,
            petLabel: petNames(petsByBooking.get(b.id) ?? []),
            releaseDate,
            released: b.status === "completed" && releaseDate <= now,
          };
        }),
      );
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  const pendingRows = rows.filter((r) => !r.released);
  const releasedRows = rows.filter((r) => r.released);
  const pendingTotal = Math.round(pendingRows.reduce((sum, r) => sum + r.netPayout, 0) * 100) / 100;
  const releasedTotal = Math.round(releasedRows.reduce((sum, r) => sum + r.netPayout, 0) * 100) / 100;

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
          <h1 className="font-serif text-xl font-semibold text-ink">Your earnings</h1>
          <p className="text-xs text-muted">Payouts go to your linked bank account</p>
        </div>
      </div>

      <div className="mx-5 mt-4 rounded-[22px] bg-gradient-to-br from-[#2C4A3E] to-[#1F3830] p-5 text-white">
        <div className="text-xs font-bold tracking-wide opacity-75 uppercase">Available to withdraw</div>
        <div className="my-1.5 font-serif text-3xl font-semibold">R{releasedTotal}</div>
        <button
          type="button"
          disabled
          className="w-full rounded-xl bg-white py-3 text-sm font-extrabold text-forest disabled:opacity-50"
        >
          Withdraw to bank
        </button>
      </div>

      <div className="mx-5 mt-4 rounded-xl bg-[#F1EEE6] px-3.5 py-2.5 text-center text-[0.68rem] leading-relaxed text-muted">
        Real payouts aren&apos;t connected yet — these numbers reflect your actual bookings, but bank
        withdrawals need Paystack, which isn&apos;t wired up.
      </div>

      <div className="mx-5 mt-4 flex gap-2.5">
        <div className="flex-1 rounded-2xl border border-line bg-white p-3 text-center">
          <div className="font-serif text-lg font-semibold text-ink">R{pendingTotal}</div>
          <div className="mt-0.5 text-[0.66rem] text-muted">Pending</div>
        </div>
        <div className="flex-1 rounded-2xl border border-line bg-white p-3 text-center">
          <div className="font-serif text-lg font-semibold text-ink">R{releasedTotal}</div>
          <div className="mt-0.5 text-[0.66rem] text-muted">Released</div>
        </div>
        <div className="flex-1 rounded-2xl border border-line bg-white p-3 text-center">
          <div className="font-serif text-lg font-semibold text-ink">{completedCount}</div>
          <div className="mt-0.5 text-[0.66rem] text-muted">Completed sits</div>
        </div>
      </div>

      <div className="mt-5 px-5 text-xs font-extrabold tracking-wide text-terracotta uppercase">
        Pending (not yet withdrawable)
      </div>
      {pendingRows.length === 0 ? (
        <div className="mx-5 mt-2 rounded-2xl border-[1.5px] border-dashed border-line bg-white p-6 text-center">
          <p className="text-xs text-muted">Nothing pending right now.</p>
        </div>
      ) : (
        <div className="mx-5 mt-2 flex flex-col gap-2">
          {pendingRows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border border-line bg-white p-3.5">
              <div>
                <h4 className="text-sm font-bold text-ink">
                  {r.serviceType} — {r.petLabel}
                </h4>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDateRange(r.dateFrom, r.dateTo)} · releases{" "}
                  {r.releaseDate.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}, if no
                  disputes
                </p>
              </div>
              <div className="text-sm font-extrabold text-terracotta">R{r.netPayout}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mx-5 mt-4 rounded-2xl bg-[#E4EEE9] p-3.5 text-xs leading-relaxed text-forest">
        💡 Owners pay the full amount upfront when a booking is confirmed, but it&apos;s held securely —
        not paid to you. It releases to your account 2 days after the sit ends, giving a short window for
        either side to flag a problem first. One payment in, one payout out — keeps transaction fees to a
        minimum on both ends.
      </div>

      <div className="mt-5 px-5 text-xs font-extrabold tracking-wide text-terracotta uppercase">
        Payout history
      </div>
      {releasedRows.length === 0 ? (
        <div className="mx-5 mt-2 rounded-2xl border-[1.5px] border-dashed border-line bg-white p-6 text-center">
          <p className="text-xs text-muted">
            No payouts released yet — they&apos;ll show up here once a pending amount clears its 2-day hold.
          </p>
        </div>
      ) : (
        <div className="mx-5 mt-2 flex flex-col gap-2">
          {releasedRows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border border-line bg-white p-3.5">
              <div>
                <h4 className="text-sm font-bold text-ink">
                  {r.serviceType} — {r.petLabel}
                </h4>
                <p className="mt-0.5 text-xs text-muted">{formatDateRange(r.dateFrom, r.dateTo)}</p>
              </div>
              <div className="text-sm font-extrabold text-forest">R{r.netPayout}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
