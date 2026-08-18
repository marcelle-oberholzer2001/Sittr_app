"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchPetsByBooking, petNames, type BookingPet } from "@/lib/booking-pets";
import { comfortableLabelFor } from "@/lib/species";
import { rateForServiceLabel, type RatesMap } from "@/lib/pet-services";
import { computeTrustScores } from "@/lib/trust-score";

interface ReferralCandidate {
  id: string;
  name: string;
  trustScore?: number;
  rate: string;
}

const SOS_REASONS = ["Family emergency", "Sudden illness", "Car / transport issue", "Personal emergency", "Other"];

interface BookingRow {
  id: string;
  owner_id: string;
  service_type: string;
  date_from: string;
  date_to: string;
  status: string;
  sitting_fee: number;
  ownerName: string;
  pets: BookingPet[];
}

function formatDateRange(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const fromStr = new Date(from).toLocaleDateString("en-ZA", opts);
  const toStr = new Date(to).toLocaleDateString("en-ZA", opts);
  return `${fromStr} – ${toStr}`;
}

export default function SitterRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [referring, setReferring] = useState(false);
  const [referQuery, setReferQuery] = useState("");
  const [referredTo, setReferredTo] = useState<string | null>(null);
  const [referCandidates, setReferCandidates] = useState<ReferralCandidate[]>([]);
  const [referLoading, setReferLoading] = useState(false);
  const [referSubmittingId, setReferSubmittingId] = useState<string | null>(null);
  const [referError, setReferError] = useState<string | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [triggeringSos, setTriggeringSos] = useState(false);
  const [sosReason, setSosReason] = useState("");
  const [sosCustomReason, setSosCustomReason] = useState("");
  const [sosSaving, setSosSaving] = useState(false);
  const [sosError, setSosError] = useState<string | null>(null);
  const [activeSosAlert, setActiveSosAlert] = useState<{ id: string; responseCount: number } | null>(null);

  async function loadBookings() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: bookingsData, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, owner_id, service_type, date_from, date_to, status, sitting_fee")
      .eq("sitter_id", uid)
      .order("created_at", { ascending: false });

    const { data: reviewsData } = await supabase
      .from("reviews")
      .select("booking_id")
      .eq("reviewer_id", uid);
    setReviewedBookingIds(new Set((reviewsData ?? []).map((r) => r.booking_id)));

    if (bookingsError || !bookingsData) {
      setLoading(false);
      return;
    }

    const ownerIds = [...new Set(bookingsData.map((b) => b.owner_id))];
    const bookingIds = bookingsData.map((b) => b.id);

    const [ownersRes, petsByBooking] = await Promise.all([
      ownerIds.length > 0
        ? supabase.from("profiles").select("id, full_name").in("id", ownerIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      fetchPetsByBooking(bookingIds),
    ]);

    const ownersById = new Map((ownersRes.data ?? []).map((o) => [o.id, o]));

    setBookings(
      bookingsData.map((b) => ({
        ...b,
        ownerName: ownersById.get(b.owner_id)?.full_name || "Pet parent",
        pets: petsByBooking.get(b.id) ?? [],
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    loadBookings();
  }, []);

  const selected = bookings.find((b) => b.id === selectedId) ?? null;

  useEffect(() => {
    setActiveSosAlert(null);
    if (!selected || selected.status !== "paid") return;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;

      const { data: alert } = await supabase
        .from("sos_alerts")
        .select("id")
        .eq("booking_id", selected.id)
        .eq("original_sitter_id", uid)
        .eq("status", "open")
        .maybeSingle();

      if (!alert) return;

      const { count } = await supabase
        .from("sos_responses")
        .select("id", { count: "exact", head: true })
        .eq("alert_id", alert.id);

      setActiveSosAlert({ id: alert.id, responseCount: count ?? 0 });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function handleTriggerSos() {
    if (!selected) return;
    const reason = sosReason === "Other" ? sosCustomReason.trim() : sosReason;
    if (!reason) return setSosError("Please choose or describe a reason.");

    setSosSaving(true);
    setSosError(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setSosSaving(false);
      return setSosError("You need to be logged in.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("coverage_areas")
      .eq("id", uid)
      .single();

    const requiredComfortLabels = [
      ...new Set(selected.pets.map((p) => comfortableLabelFor(p.species, p.size))),
    ];

    const { data: alert, error: insertError } = await supabase
      .from("sos_alerts")
      .insert({
        booking_id: selected.id,
        original_sitter_id: uid,
        reason,
        service_type: selected.service_type,
        date_from: selected.date_from,
        date_to: selected.date_to,
        pet_summary: petNames(selected.pets),
        required_comfort_labels: requiredComfortLabels,
        coverage_areas: profile?.coverage_areas ?? [],
      })
      .select("id")
      .single();

    setSosSaving(false);

    if (insertError || !alert) {
      setSosError(insertError?.message ?? "Something went wrong.");
      return;
    }

    setTriggeringSos(false);
    setSosReason("");
    setSosCustomReason("");
    setActiveSosAlert({ id: alert.id, responseCount: 0 });
  }

  useEffect(() => {
    if (!selected || !referring) return;

    (async () => {
      setReferLoading(true);
      setReferError(null);

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setReferLoading(false);
        return;
      }

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("coverage_areas")
        .eq("id", uid)
        .single();

      const myAreas = new Set<string>(myProfile?.coverage_areas ?? []);
      if (myAreas.size === 0) {
        setReferCandidates([]);
        setReferLoading(false);
        return;
      }

      const requiredComfortLabels = [
        ...new Set(selected.pets.map((p) => comfortableLabelFor(p.species, p.size))),
      ];

      // Filtered client-side rather than with a server-side `.overlaps()` query --
      // Postgrest's array-literal encoding breaks on suburb names that contain a
      // comma (e.g. "Melville, Gauteng" gets misread as two separate elements).
      const { data: candidates } = await supabase
        .from("profiles")
        .select("id, full_name, rates, comfortable_with, coverage_areas")
        .eq("is_sitter", true)
        .neq("id", uid);

      const matching = (candidates ?? []).filter((c) => {
        const areas: string[] = c.coverage_areas ?? [];
        if (!areas.some((a) => myAreas.has(a))) return false;
        const rate = rateForServiceLabel((c.rates ?? {}) as RatesMap, selected.service_type);
        if (!rate) return false;
        const comfort = c.comfortable_with ?? [];
        return requiredComfortLabels.every((label) => comfort.includes(label));
      });

      const trustScores = await computeTrustScores(matching.map((c) => c.id));

      setReferCandidates(
        matching.map((c) => ({
          id: c.id,
          name: c.full_name || "A sitter",
          trustScore: trustScores.get(c.id)?.total,
          rate: rateForServiceLabel((c.rates ?? {}) as RatesMap, selected.service_type) as string,
        })),
      );
      setReferLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referring, selectedId]);

  async function handleRefer(candidate: ReferralCandidate) {
    if (!selected) return;
    setReferSubmittingId(candidate.id);
    setReferError(null);

    const sittingFee = Number(candidate.rate.replace(/[^\d.]/g, ""));
    const platformFee = Math.round(sittingFee * 0.1 * 100) / 100;
    const totalPaid = sittingFee + platformFee;

    const { error: updateError } = await supabase.rpc("refer_booking", {
      p_booking_id: selected.id,
      p_new_sitter_id: candidate.id,
      p_sitting_fee: sittingFee,
      p_platform_fee: platformFee,
      p_total_paid: totalPaid,
    });

    setReferSubmittingId(null);

    if (updateError) {
      setReferError(updateError.message);
      return;
    }

    setReferring(false);
    setReferredTo(candidate.name);
    await loadBookings();
    setSelectedId(null);
  }

  async function updateStatus(newStatus: "accepted" | "declined" | "completed") {
    if (!selected) return;
    setUpdating(true);
    setError(null);

    const payload: { status: string; responded_at?: string } = { status: newStatus };
    if (newStatus === "accepted" || newStatus === "declined") {
      payload.responded_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase.from("bookings").update(payload).eq("id", selected.id);

    setUpdating(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setBookings((prev) => prev.map((b) => (b.id === selected.id ? { ...b, status: newStatus } : b)));
  }

  const filteredReferrals = referCandidates.filter((s) =>
    s.name.toLowerCase().includes(referQuery.toLowerCase()),
  );

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  // Referral confirmation — shown standalone since the booking no longer
  // belongs to this sitter once referred, so `selected` won't exist anymore.
  if (referredTo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
        <div className="mb-4 text-3xl">✓</div>
        <h1 className="mb-2 font-serif text-xl font-semibold text-ink">Referred to {referredTo}</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">
          They&apos;ll see this as a new request in their own list, at their own rate. It&apos;s no longer
          on your list.
        </p>
        <button
          type="button"
          onClick={() => setReferredTo(null)}
          className="rounded-2xl bg-forest px-6 py-3.5 text-sm font-bold text-white"
        >
          Back to requests
        </button>
      </div>
    );
  }

  // SOS trigger sub-view
  if (selected && triggeringSos) {
    return (
      <div className="flex min-h-screen flex-col bg-paper pb-8">
        <div className="flex items-center gap-3 px-5 pt-4">
          <button
            type="button"
            onClick={() => setTriggeringSos(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-sm"
          >
            ←
          </button>
          <div>
            <h1 className="font-serif text-xl font-semibold text-ink">🆘 Trigger SOS</h1>
            <p className="text-xs text-muted">
              We&apos;ll alert nearby sitters and let {selected.ownerName} pick a replacement.
            </p>
          </div>
        </div>

        <div className="px-5 pt-4">
          <p className="mb-2 text-xs font-extrabold tracking-wide text-muted uppercase">What&apos;s going on?</p>
          <div className="mb-3 flex flex-col gap-2">
            {SOS_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSosReason(r)}
                className={`rounded-xl border-[1.5px] px-3.5 py-3 text-left text-sm font-bold ${
                  sosReason === r ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {sosReason === "Other" && (
            <textarea
              rows={2}
              value={sosCustomReason}
              onChange={(e) => setSosCustomReason(e.target.value)}
              placeholder="Briefly describe what's happening"
              className="mb-3 w-full resize-none rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
            />
          )}

          <p className="mb-4 rounded-xl bg-[#F3E3D6] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
            This won&apos;t count against your reliability score. {selected.ownerName} approves whoever
            takes over before any handoff happens — nothing changes until she does.
          </p>

          {sosError && (
            <p className="mb-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
              {sosError}
            </p>
          )}

          <button
            type="button"
            disabled={sosSaving || !sosReason}
            onClick={handleTriggerSos}
            className="w-full rounded-2xl bg-terracotta py-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {sosSaving ? "Sending…" : "🆘 Send SOS alert"}
          </button>
        </div>
      </div>
    );
  }

  // Referral sub-view
  if (selected && referring) {
    return (
      <div className="flex min-h-screen flex-col bg-paper pb-8">
        <div className="flex items-center gap-3 px-5 pt-4">
          <button
            type="button"
            onClick={() => setReferring(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-sm"
          >
            ←
          </button>
          <div>
            <h1 className="font-serif text-xl font-semibold text-ink">Refer a sitter</h1>
            <p className="text-xs text-muted">
              Verified sitters covering your area, comfortable with {petNames(selected.pets)}
            </p>
          </div>
        </div>
        <div className="px-5 pt-4">
          <div className="mb-3 flex items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-muted">
            🔍
            <input
              type="text"
              value={referQuery}
              onChange={(e) => setReferQuery(e.target.value)}
              placeholder="Search by name..."
              className="w-full text-sm text-ink outline-none placeholder:text-muted"
            />
          </div>

          {referError && (
            <p className="mb-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
              {referError}
            </p>
          )}

          {referLoading ? (
            <p className="py-6 text-center text-xs text-muted">Finding sitters near you…</p>
          ) : filteredReferrals.length === 0 ? (
            <p className="rounded-2xl border-[1.5px] border-dashed border-line bg-white px-3.5 py-6 text-center text-xs text-muted">
              No sitters cover your area with a rate set for {selected.service_type} and comfort
              with {petNames(selected.pets)} yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredReferrals.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 rounded-2xl border border-line bg-white p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest font-serif font-semibold text-white">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-serif text-sm font-semibold text-ink">{s.name}</div>
                    <div className="text-xs text-muted">
                      ✓ Verified
                      {s.trustScore !== undefined && <> · 🛡 {s.trustScore}</>} · {s.rate}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={referSubmittingId !== null}
                    onClick={() => handleRefer(s)}
                    className="rounded-lg border-[1.5px] border-forest px-2.5 py-1.5 text-xs font-bold text-forest disabled:opacity-50"
                  >
                    {referSubmittingId === s.id ? "Referring…" : "Refer"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 rounded-xl bg-[#F1EEE6] px-3.5 py-3 text-xs leading-relaxed text-muted">
            🐾 {selected.ownerName}&apos;s request moves to them at their own rate — they still need to
            accept it like any new request. It leaves your list either way.
          </p>
        </div>
      </div>
    );
  }

  // List view
  if (!selected) {
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
          <h1 className="font-serif text-xl font-semibold text-ink">Requests</h1>
        </div>

        <div className="px-5 pt-4">
          {bookings.length === 0 && (
            <p className="rounded-2xl border-[1.5px] border-dashed border-line bg-white px-3.5 py-6 text-center text-xs text-muted">
              No booking requests yet.
            </p>
          )}
          <div className="flex flex-col gap-3">
            {bookings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelectedId(b.id);
                  setAgreeChecked(false);
                  setReferring(false);
                  setReferredTo(null);
                }}
                className="rounded-2xl border border-line bg-white p-3.5 text-left"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-serif text-sm font-semibold text-ink">{b.ownerName}</span>
                  <span
                    className={`rounded-lg px-2 py-1 text-[0.62rem] font-extrabold ${
                      b.status === "pending" || b.status === "agreed"
                        ? "bg-terracotta text-white"
                        : b.status === "accepted" || b.status === "paid" || b.status === "completed"
                          ? "bg-forest text-white"
                          : "bg-line text-muted"
                    }`}
                  >
                    {b.status === "pending" ? "NEW" : b.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {b.service_type} · {formatDateRange(b.date_from, b.date_to)}
                </p>
                <p className="text-xs text-muted">For {petNames(b.pets)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const netPayout = Math.round(selected.sitting_fee * 0.9 * 100) / 100;

  return (
    <div className="flex min-h-screen flex-col bg-paper pb-8">
      <div className="flex items-center gap-3 px-5 pt-4">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-sm"
        >
          ←
        </button>
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink">
            {selected.status === "pending" ? "New booking request" : "Booking request"}
          </h1>
          {selected.status === "pending" && (
            <p className="text-xs text-muted">Respond within 12 hours to keep your response rate up</p>
          )}
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="mb-4 rounded-2xl border border-line bg-white p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-terracotta font-serif font-semibold text-white">
              {selected.ownerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="font-serif text-sm font-semibold text-ink">{selected.ownerName}</div>
              <div className="text-xs text-muted">Pet parent</div>
            </div>
            {selected.status === "pending" && (
              <span className="rounded-lg bg-terracotta px-2 py-1 text-[0.62rem] font-extrabold text-white">
                NEW
              </span>
            )}
          </div>

          <div className="flex justify-between border-b border-line py-1.5 text-sm">
            <span className="text-muted">Service</span>
            <span className="font-bold text-ink">{selected.service_type}</span>
          </div>
          <div className="flex justify-between border-b border-line py-1.5 text-sm">
            <span className="text-muted">Dates</span>
            <span className="font-bold text-ink">{formatDateRange(selected.date_from, selected.date_to)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted">You&apos;ll earn</span>
            <span className="font-bold text-ink">R{netPayout} (after commission)</span>
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            {selected.pets.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 rounded-xl bg-[#F1EEE6] px-3 py-2.5">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-forest" />
                <div>
                  <h4 className="text-xs font-bold text-ink">
                    {p.name}
                    {p.size ? ` — ${p.size} dog` : ""}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
            {error}
          </p>
        )}

        {selected.status === "pending" && (
          <>
            <div className="mb-4 flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => setAgreeChecked((v) => !v)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-[1.5px] text-xs text-white ${
                  agreeChecked ? "border-forest bg-forest" : "border-line bg-white"
                }`}
              >
                {agreeChecked && "✓"}
              </button>
              <p className="text-xs leading-relaxed text-ink">
                By accepting, you agree to the auto-generated booking agreement for this sit, including
                the cancellation policy and emergency plan shown to {selected.ownerName}.
              </p>
            </div>

            <div className="mb-2 flex gap-2">
              <button
                type="button"
                disabled={!agreeChecked || updating}
                onClick={() => updateStatus("accepted")}
                className="flex-1 rounded-2xl bg-forest py-3.5 text-xs font-bold text-white disabled:opacity-40"
              >
                {updating ? "Saving…" : "Accept & agree"}
              </button>
              <button
                type="button"
                onClick={() => setReferring(true)}
                className="flex-1 rounded-2xl border-[1.5px] border-terracotta py-3.5 text-xs font-bold text-terracotta"
              >
                Refer someone
              </button>
            </div>
            <button
              type="button"
              disabled={updating}
              onClick={() => updateStatus("declined")}
              className="mb-2 w-full rounded-2xl border-[1.5px] border-line py-3.5 text-xs font-bold text-muted disabled:opacity-40"
            >
              Decline — I&apos;m fully booked
            </button>
            <p className="text-center text-xs leading-relaxed text-muted">
              Declining doesn&apos;t affect your rating. It only counts against your acceptance rate if
              you don&apos;t respond at all.
            </p>
          </>
        )}

        {selected.status === "accepted" && (
          <div className="rounded-2xl bg-[#E4EEE9] p-4 text-center">
            <p className="text-sm font-bold text-forest">✓ You accepted this request</p>
            <p className="mt-1 text-xs leading-relaxed text-forest">
              {selected.ownerName} will review the booking agreement and pay to confirm. You&apos;ll be
              notified once they do.
            </p>
          </div>
        )}

        {selected.status === "declined" && (
          <div className="rounded-2xl bg-[#F1EEE6] p-4 text-center">
            <p className="text-sm font-bold text-ink">Declined</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {selected.ownerName} has been notified. This won&apos;t affect your rating.
            </p>
          </div>
        )}

        {selected.status === "agreed" && (
          <div className="rounded-2xl bg-[#F3E3D6] p-4 text-center">
            <p className="text-sm font-bold text-terracotta">Waiting for payment</p>
            <p className="mt-1 text-xs leading-relaxed text-terracotta">
              {selected.ownerName} has agreed to the booking and needs to pay to confirm it.
            </p>
          </div>
        )}

        {selected.status === "paid" && (
          <>
            <div className="rounded-2xl bg-[#E4EEE9] p-4 text-center">
              <p className="text-sm font-bold text-forest">✓ Paid — booking confirmed</p>
              <p className="mt-1 text-xs leading-relaxed text-forest">
                You&apos;re paid once the sit is complete and nothing&apos;s disputed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/chat/${selected.id}`)}
              className="mt-4 w-full rounded-2xl border-[1.5px] border-forest py-3.5 text-xs font-bold text-forest"
            >
              🤝 Message {selected.ownerName}
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={() => updateStatus("completed")}
              className="mt-2.5 w-full rounded-2xl bg-forest py-3.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {updating ? "Saving…" : "Mark sit as complete"}
            </button>

            {activeSosAlert ? (
              <div className="mt-4 rounded-2xl border-[1.5px] border-terracotta bg-[#F3E3D6] p-4 text-center">
                <p className="text-sm font-bold text-terracotta">🆘 SOS active</p>
                <p className="mt-1 text-xs leading-relaxed text-terracotta">
                  {activeSosAlert.responseCount === 0
                    ? `Waiting for a nearby sitter to respond. ${selected.ownerName} will pick from whoever answers.`
                    : `${activeSosAlert.responseCount} sitter${activeSosAlert.responseCount === 1 ? " has" : "s have"} responded. ${selected.ownerName} is choosing who takes over.`}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTriggeringSos(true)}
                className="mt-4 w-full rounded-2xl border-[1.5px] border-terracotta py-3.5 text-xs font-bold text-terracotta"
              >
                🆘 Something&apos;s come up — trigger SOS
              </button>
            )}
          </>
        )}

        {selected.status === "completed" && (
          <>
            <div className="rounded-2xl bg-[#F1EEE6] p-4 text-center">
              <p className="text-sm font-bold text-ink">✓ Completed with {selected.ownerName}</p>
            </div>
            {reviewedBookingIds.has(selected.id) ? (
              <p className="mt-4 text-center text-sm font-bold text-forest">✓ You reviewed this sit</p>
            ) : (
              <button
                type="button"
                onClick={() => router.push(`/sitter/review?bookingId=${selected.id}`)}
                className="mt-4 w-full rounded-2xl bg-forest py-3.5 text-xs font-bold text-white"
              >
                Leave a review
              </button>
            )}
          </>
        )}

        {referredTo && (
          <div className="mt-4 rounded-2xl bg-[#E4EEE9] p-4 text-center">
            <p className="text-sm font-bold text-forest">✓ Referred to {referredTo}</p>
            <p className="mt-1 text-xs leading-relaxed text-forest">
              (Demo only — no notification was actually sent.)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
