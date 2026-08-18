"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const MAX_MONTHS_AHEAD = 12;
const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const CONFIRMED_STATUSES = ["accepted", "agreed", "paid"];

function toISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = toISO(addDays(new Date(cursor), 1));
  }
  return dates;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric" });

interface BookedInfo {
  service: string;
  ownerName: string;
}

export default function AvailabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayISO = toISO(today);
  const currentMonthStart = useMemo(() => startOfMonth(today), [today]);

  const [viewDate, setViewDate] = useState(currentMonthStart);
  const [bookedByDate, setBookedByDate] = useState<Map<string, BookedInfo>>(new Map());
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());

  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [pendingTargetBlocked, setPendingTargetBlocked] = useState<boolean | null>(null);
  const [popupDate, setPopupDate] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      setUserId(uid);

      const [blockedRes, bookingsRes] = await Promise.all([
        supabase.from("sitter_blocked_dates").select("date").eq("sitter_id", uid),
        supabase
          .from("bookings")
          .select("owner_id, service_type, date_from, date_to")
          .eq("sitter_id", uid)
          .in("status", CONFIRMED_STATUSES),
      ]);

      setBlockedDates(new Set((blockedRes.data ?? []).map((r) => r.date)));

      const bookings = bookingsRes.data ?? [];
      const ownerIds = [...new Set(bookings.map((b) => b.owner_id))];
      const { data: ownersData } =
        ownerIds.length > 0
          ? await supabase.from("profiles").select("id, full_name").in("id", ownerIds)
          : { data: [] as { id: string; full_name: string | null }[] };
      const ownersById = new Map((ownersData ?? []).map((o) => [o.id, o]));

      const booked = new Map<string, BookedInfo>();
      for (const b of bookings) {
        const info: BookedInfo = {
          service: b.service_type,
          ownerName: ownersById.get(b.owner_id)?.full_name || "a pet parent",
        };
        for (const date of datesBetween(b.date_from, b.date_to)) {
          booked.set(date, info);
        }
      }
      setBookedByDate(booked);

      setLoading(false);
    })();
  }, []);

  const monthIndex =
    (viewDate.getFullYear() - currentMonthStart.getFullYear()) * 12 +
    (viewDate.getMonth() - currentMonthStart.getMonth());
  const canGoPrev = monthIndex > 0;
  const canGoNext = monthIndex < MAX_MONTHS_AHEAD - 1;

  function goToMonth(delta: number) {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function cancelSelection() {
    setPendingStart(null);
    setPendingTargetBlocked(null);
  }

  async function handleDayClick(iso: string) {
    if (iso < todayISO || !userId) return;

    if (bookedByDate.has(iso)) {
      setPopupDate(iso);
      return;
    }
    setPopupDate(null);

    if (!pendingStart) {
      setPendingStart(iso);
      setPendingTargetBlocked(!blockedDates.has(iso));
      return;
    }

    const [from, to] = pendingStart <= iso ? [pendingStart, iso] : [iso, pendingStart];
    const rangeDates = datesBetween(from, to).filter((d) => !bookedByDate.has(d));

    cancelSelection();
    setSaving(true);
    setError(null);

    if (pendingTargetBlocked) {
      const { error: insertError } = await supabase
        .from("sitter_blocked_dates")
        .upsert(rangeDates.map((date) => ({ sitter_id: userId, date })), { onConflict: "sitter_id,date" });
      setSaving(false);
      if (insertError) return setError(insertError.message);
      setBlockedDates((prev) => new Set([...prev, ...rangeDates]));
    } else {
      const { error: deleteError } = await supabase
        .from("sitter_blocked_dates")
        .delete()
        .eq("sitter_id", userId)
        .in("date", rangeDates);
      setSaving(false);
      if (deleteError) return setError(deleteError.message);
      setBlockedDates((prev) => {
        const next = new Set(prev);
        rangeDates.forEach((d) => next.delete(d));
        return next;
      });
    }
  }

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const cells: { iso: string; day: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, iso: toISO(new Date(viewDate.getFullYear(), viewDate.getMonth(), d)) });
  }

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  const popupInfo = popupDate ? bookedByDate.get(popupDate) : null;

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
          <h1 className="font-serif text-xl font-semibold text-ink">Your availability</h1>
          <p className="text-xs text-muted">Tap a date to block it, or tap a start and end date to block a range.</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between px-5">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => goToMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-sm text-forest disabled:opacity-30"
        >
          ‹
        </button>
        <div className="font-serif text-base font-semibold text-ink">{MONTH_FORMAT.format(viewDate)}</div>
        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => goToMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-sm text-forest disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="mx-5 mt-3 rounded-2xl border border-line bg-white p-3.5">
        <div className="mb-2 grid grid-cols-7">
          {DOW_LABELS.map((d, i) => (
            <span key={i} className="text-center text-[0.66rem] font-extrabold text-muted">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstWeekday }, (_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}
          {cells.map(({ day, iso }) => {
            const isPast = iso < todayISO;
            const isToday = iso === todayISO;
            const isBooked = bookedByDate.has(iso);
            const isBlocked = blockedDates.has(iso);
            const isPending = pendingStart === iso;

            let cls =
              "aspect-square rounded-[9px] flex items-center justify-center text-[0.8rem] font-bold border-[1.5px] ";
            if (isPast) cls += "text-line border-transparent cursor-default";
            else if (isBooked) cls += "bg-forest border-forest text-white cursor-pointer";
            else if (isPending) cls += "bg-white border-terracotta text-ink cursor-pointer";
            else if (isBlocked) cls += "bg-[#F1EEE6] border-[#F1EEE6] text-muted line-through cursor-pointer";
            else cls += "bg-white border-line text-ink cursor-pointer";
            if (isToday) cls += " shadow-[0_0_0_2px_#C77A4E]";

            return (
              <button
                key={iso}
                type="button"
                disabled={isPast || saving}
                onClick={() => handleDayClick(iso)}
                className={cls}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-5 mt-3 flex flex-wrap gap-3.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <span className="h-3.5 w-3.5 rounded border-[1.5px] border-line bg-white" /> Available
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <span className="h-3.5 w-3.5 rounded bg-[#F1EEE6]" /> Blocked by you
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <span className="h-3.5 w-3.5 rounded bg-forest" /> Booked
        </div>
      </div>

      {error && (
        <p className="mx-5 mt-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
          {error}
        </p>
      )}

      {popupDate && popupInfo && (
        <div className="mx-5 mt-4 rounded-2xl border-[1.5px] border-forest bg-white p-3.5">
          <h4 className="mb-0.5 font-serif text-sm font-semibold text-ink">🐾 {popupInfo.service}</h4>
          <p className="text-xs text-muted">Booked by {popupInfo.ownerName}</p>
          <p className="mt-2 text-xs font-bold text-terracotta">
            🔒 Locked automatically — cancel the booking itself to free these dates.
          </p>
        </div>
      )}

      {pendingStart && (
        <div className="mx-5 mt-4 flex items-center justify-between rounded-2xl bg-[#F3E3D6] px-3.5 py-3 text-xs font-bold text-terracotta">
          <span>
            Selecting from {pendingStart} — tap an end date, or tap it again for just that day.
          </span>
          <button type="button" onClick={cancelSelection} className="ml-2 shrink-0 underline">
            Cancel
          </button>
        </div>
      )}

      <div className="mx-5 mt-4 rounded-2xl bg-[#E4EEE9] px-3.5 py-3 text-xs leading-relaxed text-forest">
        💡 These dates feed search directly — if you block a range, you simply won&apos;t appear when an
        owner searches for a sitter in that window. No need to decline requests you were never going to
        accept.
      </div>
    </div>
  );
}
