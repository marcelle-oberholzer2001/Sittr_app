"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface SosAlertRow {
  id: string;
  reason: string;
  service_type: string;
  date_from: string;
  date_to: string;
  pet_summary: string;
  required_comfort_labels: string[];
  coverage_areas: string[];
  created_at: string;
}

function formatDateRange(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const fromStr = new Date(from).toLocaleDateString("en-ZA", opts);
  const toStr = new Date(to).toLocaleDateString("en-ZA", opts);
  return `${fromStr} – ${toStr}`;
}

function toISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    const next = new Date(cursor);
    next.setDate(next.getDate() + 1);
    cursor = toISO(next);
  }
  return dates;
}

export default function SitterSosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<SosAlertRow[]>([]);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [responding, setResponding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("coverage_areas, comfortable_with")
      .eq("id", uid)
      .single();

    const myAreas = new Set(profile?.coverage_areas ?? []);
    const myComfort = new Set(profile?.comfortable_with ?? []);
    const today = toISO(new Date());

    const [alertsRes, responsesRes, blockedRes, bookingsRes] = await Promise.all([
      supabase
        .from("sos_alerts")
        .select(
          "id, reason, service_type, date_from, date_to, pet_summary, required_comfort_labels, coverage_areas, created_at, original_sitter_id",
        )
        .eq("status", "open")
        .neq("original_sitter_id", uid)
        .order("created_at", { ascending: false }),
      supabase.from("sos_responses").select("alert_id").eq("sitter_id", uid),
      supabase.from("sitter_blocked_dates").select("date").eq("sitter_id", uid),
      supabase
        .from("bookings")
        .select("date_from, date_to")
        .eq("sitter_id", uid)
        .in("status", ["accepted", "agreed", "paid"]),
    ]);

    setRespondedIds(new Set((responsesRes.data ?? []).map((r) => r.alert_id)));

    const unavailableDates = new Set<string>((blockedRes.data ?? []).map((r) => r.date));
    for (const b of bookingsRes.data ?? []) {
      for (const d of datesBetween(b.date_from, b.date_to)) unavailableDates.add(d);
    }

    const matching = (alertsRes.data ?? []).filter((a) => {
      const areaMatch = a.coverage_areas.some((area: string) => myAreas.has(area));
      const comfortMatch = a.required_comfort_labels.every((label: string) => myComfort.has(label));
      const windowFrom = a.date_from < today ? today : a.date_from;
      const availableForWindow = !datesBetween(windowFrom, a.date_to).some((d) => unavailableDates.has(d));
      return areaMatch && comfortMatch && availableForWindow;
    });

    setAlerts(matching);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function respond(alertId: string) {
    setResponding(alertId);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setResponding(null);
      return setError("You need to be logged in.");
    }

    const { error: insertError } = await supabase
      .from("sos_responses")
      .insert({ alert_id: alertId, sitter_id: uid });

    setResponding(null);

    if (insertError) return setError(insertError.message);

    setRespondedIds((prev) => new Set([...prev, alertId]));
  }

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
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
          <h1 className="font-serif text-xl font-semibold text-ink">🆘 SOS alerts</h1>
          <p className="text-xs text-muted">Sitters nearby who need urgent backup</p>
        </div>
      </div>

      <div className="px-5 pt-4">
        {alerts.length === 0 ? (
          <div className="rounded-2xl border-[1.5px] border-dashed border-line bg-white px-3.5 py-6 text-center">
            <p className="text-xs text-muted">No SOS alerts near you right now.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {alerts.map((a) => {
              const alreadyResponded = respondedIds.has(a.id);
              return (
                <div key={a.id} className="rounded-2xl border-[1.5px] border-terracotta bg-white p-3.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">{a.service_type}</span>
                    <span className="rounded-lg bg-[#F3E3D6] px-2 py-1 text-[0.62rem] font-extrabold text-terracotta">
                      {a.reason}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {formatDateRange(a.date_from, a.date_to)} · {a.pet_summary}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Covers {a.coverage_areas.join(", ")}</p>
                  <button
                    type="button"
                    disabled={alreadyResponded || responding === a.id}
                    onClick={() => respond(a.id)}
                    className="mt-3 w-full rounded-xl bg-terracotta py-2.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {alreadyResponded ? "✓ You've responded" : responding === a.id ? "Sending…" : "I can help"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
