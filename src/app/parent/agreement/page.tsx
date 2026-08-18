"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchPetsByBooking, petNames, type BookingPet } from "@/lib/booking-pets";
import { computeTrustScores } from "@/lib/trust-score";

interface BookingDetail {
  id: string;
  sitter_id: string;
  service_type: string;
  date_from: string;
  date_to: string;
  status: string;
  sitting_fee: number;
  platform_fee: number;
  total_paid: number;
  sitterName: string;
  ownerName: string;
  sitterHasLicense: boolean | null;
  sitterBackupDriver: string | null;
  pets: BookingPet[];
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 rounded-2xl border border-line bg-white p-3.5">
      <h4 className="mb-2 flex items-center gap-1.5 font-serif text-sm font-semibold text-ink">
        {icon} {title}
      </h4>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-xs">
      <span className="text-muted">{label}</span>
      <span className="font-bold text-ink">{value}</span>
    </div>
  );
}

function formatDateRange(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const fromStr = new Date(from).toLocaleDateString("en-ZA", opts);
  const toStr = new Date(to).toLocaleDateString("en-ZA", opts);
  const nights = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
  return `${fromStr}–${toStr} (${nights} night${nights === 1 ? "" : "s"})`;
}

export default function BookingAgreementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [sosAlert, setSosAlert] = useState<{ id: string; reason: string } | null>(null);
  const [sosResponders, setSosResponders] = useState<{ id: string; name: string; trustScore?: number }[]>([]);
  const [approving, setApproving] = useState<string | null>(null);

  async function loadBookings() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("*")
      .eq("owner_id", uid)
      .order("created_at", { ascending: false });

    const { data: reviewsData } = await supabase
      .from("reviews")
      .select("booking_id")
      .eq("reviewer_id", uid);
    setReviewedBookingIds(new Set((reviewsData ?? []).map((r) => r.booking_id)));

    if (!bookingsData || bookingsData.length === 0) {
      setLoading(false);
      return;
    }

    const sitterIds = [...new Set(bookingsData.map((b) => b.sitter_id))];
    const bookingIds = bookingsData.map((b) => b.id);

    const [sittersRes, ownerRes, petsByBooking] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, has_drivers_license, backup_driver_contact")
        .in("id", sitterIds),
      supabase.from("profiles").select("full_name").eq("id", uid).single(),
      fetchPetsByBooking(bookingIds),
    ]);

    const sittersById = new Map((sittersRes.data ?? []).map((s) => [s.id, s]));
    const ownerName = ownerRes.data?.full_name || "You";

    setBookings(
      bookingsData.map((b) => ({
        ...b,
        sitterName: sittersById.get(b.sitter_id)?.full_name || "Sitter",
        ownerName,
        sitterHasLicense: sittersById.get(b.sitter_id)?.has_drivers_license ?? null,
        sitterBackupDriver: sittersById.get(b.sitter_id)?.backup_driver_contact ?? null,
        pets: petsByBooking.get(b.id) ?? [],
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    loadBookings();
  }, []);

  const selected = bookings.find((b) => b.id === selectedId) ?? null;
  const canContinue = agreeChecked && signature.trim().length > 0;

  useEffect(() => {
    setSosAlert(null);
    setSosResponders([]);
    if (!selected || selected.status !== "paid") return;

    (async () => {
      const { data: alert } = await supabase
        .from("sos_alerts")
        .select("id, reason")
        .eq("booking_id", selected.id)
        .eq("status", "open")
        .maybeSingle();

      if (!alert) return;
      setSosAlert(alert);

      const { data: responses } = await supabase
        .from("sos_responses")
        .select("sitter_id")
        .eq("alert_id", alert.id);

      const sitterIds = (responses ?? []).map((r) => r.sitter_id);
      if (sitterIds.length === 0) return;

      const [{ data: sitters }, trustScores] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", sitterIds),
        computeTrustScores(sitterIds),
      ]);

      setSosResponders(
        (sitters ?? []).map((s) => ({
          id: s.id,
          name: s.full_name || "A sitter",
          trustScore: trustScores.get(s.id)?.total,
        })),
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function handleApproveResponder(newSitterId: string) {
    if (!selected || !sosAlert) return;
    setApproving(newSitterId);
    setError(null);

    const { error: bookingError } = await supabase
      .from("bookings")
      .update({ sitter_id: newSitterId })
      .eq("id", selected.id);

    if (bookingError) {
      setApproving(null);
      setError(bookingError.message);
      return;
    }

    const { error: alertError } = await supabase
      .from("sos_alerts")
      .update({ status: "assigned", assigned_sitter_id: newSitterId, resolved_at: new Date().toISOString() })
      .eq("id", sosAlert.id);

    setApproving(null);

    if (alertError) return setError(alertError.message);

    setSosAlert(null);
    setSosResponders([]);
    await loadBookings();
  }

  async function handleAgree() {
    if (!selected) return;
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "agreed" })
      .eq("id", selected.id);

    setSaving(false);
    if (updateError) return setError(updateError.message);

    setBookings((prev) => prev.map((b) => (b.id === selected.id ? { ...b, status: "agreed" } : b)));
  }

  async function handlePay() {
    if (!selected) return;
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "paid" })
      .eq("id", selected.id);

    setSaving(false);
    if (updateError) return setError(updateError.message);

    setBookings((prev) => prev.map((b) => (b.id === selected.id ? { ...b, status: "paid" } : b)));
  }

  async function handleMarkComplete() {
    if (!selected) return;
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", selected.id);

    setSaving(false);
    if (updateError) return setError(updateError.message);

    setBookings((prev) => prev.map((b) => (b.id === selected.id ? { ...b, status: "completed" } : b)));
  }

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
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
          <h1 className="font-serif text-xl font-semibold text-ink">Your requests</h1>
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
                  setSignature("");
                  setError(null);
                }}
                className="rounded-2xl border border-line bg-white p-3.5 text-left"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-serif text-sm font-semibold text-ink">{b.sitterName}</span>
                  <span
                    className={`rounded-lg px-2 py-1 text-[0.62rem] font-extrabold ${
                      b.status === "paid" || b.status === "completed" || b.status === "accepted"
                        ? "bg-forest text-white"
                        : b.status === "declined"
                          ? "bg-line text-muted"
                          : "bg-terracotta text-white"
                    }`}
                  >
                    {b.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {b.service_type} for {petNames(b.pets)} · {formatDateRange(b.date_from, b.date_to)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Pending / declined: simple read-only status
  if (selected.status === "pending" || selected.status === "declined") {
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
          <h1 className="font-serif text-xl font-semibold text-ink">
            {selected.sitterName} — {selected.service_type}
          </h1>
        </div>
        <div className="px-5 pt-4">
          <div
            className={`rounded-2xl p-4 text-center ${
              selected.status === "pending" ? "bg-[#F3E3D6]" : "bg-[#F1EEE6]"
            }`}
          >
            <p className="text-sm font-bold text-ink">
              {selected.status === "pending" ? "Waiting for a response" : "Declined"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {selected.status === "pending"
                ? `${selected.sitterName} hasn't responded to this request yet.`
                : `${selected.sitterName} declined this request. Try browsing for another sitter.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Paid: confirmed read-only
  if (selected.status === "paid") {
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
          <h1 className="font-serif text-xl font-semibold text-ink">Booking confirmed</h1>
        </div>
        <div className="px-5 pt-4">
          <div className="rounded-2xl bg-[#E4EEE9] p-4 text-center">
            <p className="text-sm font-bold text-forest">✓ Paid — R{selected.total_paid}</p>
            <p className="mt-1 text-xs leading-relaxed text-forest">
              {selected.sitterName} is only paid once the sit is complete. You&apos;ll be notified
              throughout.
            </p>
          </div>

          {sosAlert && (
            <div className="mt-4 rounded-2xl border-[1.5px] border-terracotta bg-white p-4">
              <p className="text-sm font-bold text-terracotta">
                🆘 {selected.sitterName} can&apos;t continue this sit
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">Reason: {sosAlert.reason}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Nearby sitters have been alerted. Nothing changes until you approve someone
                below.
              </p>
              {sosResponders.length === 0 ? (
                <p className="mt-3 text-center text-xs text-muted">Waiting for a sitter to respond…</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {sosResponders.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-xl border border-line bg-white p-3"
                    >
                      <div>
                        <div className="text-sm font-bold text-ink">{r.name}</div>
                        {r.trustScore !== undefined && (
                          <div className="text-xs text-muted">🛡 Trust Score {r.trustScore}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={approving !== null}
                        onClick={() => handleApproveResponder(r.id)}
                        className="rounded-lg bg-forest px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {approving === r.id ? "Approving…" : "Approve"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push(`/chat/${selected.id}`)}
            className="mt-4 w-full rounded-2xl border-[1.5px] border-forest py-3.5 text-sm font-bold text-forest"
          >
            🤝 Arrange meet &amp; greet
          </button>

          {error && (
            <p className="mt-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={handleMarkComplete}
            className="mt-4 w-full rounded-2xl bg-forest py-3.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Mark sit as complete"}
          </button>
          <p className="mt-2 text-center text-xs text-muted">
            Once the sit is over, mark it complete to leave a review and release payment.
          </p>

          <button
            type="button"
            onClick={() => router.push(`/parent/cancel?bookingId=${selected.id}`)}
            className="mt-4 w-full text-center text-xs font-bold text-muted underline"
          >
            Need to cancel this booking?
          </button>
        </div>
      </div>
    );
  }

  // Completed: leave a review
  if (selected.status === "completed") {
    const alreadyReviewed = reviewedBookingIds.has(selected.id);
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
          <h1 className="font-serif text-xl font-semibold text-ink">Sit complete</h1>
        </div>
        <div className="px-5 pt-4">
          <div className="rounded-2xl bg-[#F1EEE6] p-4 text-center">
            <p className="text-sm font-bold text-ink">✓ Completed with {selected.sitterName}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {formatDateRange(selected.date_from, selected.date_to)}
            </p>
          </div>
          {alreadyReviewed ? (
            <p className="mt-4 text-center text-sm font-bold text-forest">✓ You reviewed this sit</p>
          ) : (
            <button
              type="button"
              onClick={() => router.push(`/parent/review?bookingId=${selected.id}`)}
              className="mt-4 w-full rounded-2xl bg-forest py-3.5 text-sm font-bold text-white"
            >
              Leave a review
            </button>
          )}
        </div>
      </div>
    );
  }

  // Agreed: pay stage
  if (selected.status === "agreed") {
    return (
      <div className="flex min-h-screen flex-col bg-paper pb-8">
        <div className="px-5 pt-10 pb-2 text-center">
          <div className="text-3xl">🎉</div>
          <h1 className="mt-2 font-serif text-xl font-semibold text-ink">{selected.sitterName} accepted!</h1>
          <p className="mt-1 text-sm text-muted">
            Pay in full to secure your booking — {selected.sitterName} is only paid once the sit is
            complete.
          </p>
        </div>

        <div className="mx-5 mt-4 rounded-2xl border border-line bg-white p-4">
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted">Sitting fee</span>
            <span className="font-bold text-ink">R{selected.sitting_fee}</span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted">Platform fee</span>
            <span className="font-bold text-ink">R{selected.platform_fee}</span>
          </div>
          <div className="mt-1.5 flex justify-between border-t border-line pt-2.5 text-base font-extrabold">
            <span className="text-ink">Total</span>
            <span className="text-ink">R{selected.total_paid}</span>
          </div>
        </div>

        <div className="mx-5 mt-3 rounded-xl bg-[#F3E3D6] px-3.5 py-3 text-xs leading-relaxed font-bold text-terracotta">
          💳 Full payment now: R{selected.total_paid}. {selected.sitterName} never receives it upfront —
          it&apos;s held securely and released 2 days after the sit ends, as long as nothing&apos;s
          disputed.
        </div>

        {error && (
          <p className="mx-5 mt-3 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
            {error}
          </p>
        )}

        <div className="mx-5 mt-4">
          <button
            type="button"
            disabled={saving}
            onClick={handlePay}
            className="w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "Processing…" : `Pay now — R${selected.total_paid}`}
          </button>
        </div>
      </div>
    );
  }

  // Accepted: sign stage
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
          <h1 className="font-serif text-xl font-semibold text-ink">Review your booking agreement</h1>
          <p className="text-xs text-muted">
            With {selected.sitterName} · {formatDateRange(selected.date_from, selected.date_to)}
          </p>
        </div>
      </div>

      <div className="px-5 pt-3 pb-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E4EEE9] px-3 py-1.5 text-xs font-bold text-forest">
          ✨ Auto-filled from your booking — nothing to type
        </span>
      </div>

      <div className="px-5 pt-3">
        <Section icon="👤" title="Parties">
          <KV label="Owner" value={selected.ownerName} />
          <KV label="Sitter" value={selected.sitterName} />
        </Section>

        <Section icon="🐾" title="Pets & service">
          {selected.pets.map((p) => (
            <KV key={p.id} label="Pet" value={p.size ? `${p.name} (${p.size} dog)` : p.name} />
          ))}
          <KV label="Service" value={selected.service_type} />
          <KV label="Dates" value={formatDateRange(selected.date_from, selected.date_to)} />
        </Section>

        <Section icon="💳" title="Payment">
          <KV label="Sitting fee" value={`R${selected.sitting_fee}`} />
          <KV label="Platform fee" value={`R${selected.platform_fee}`} />
          <KV label="Total (paid now)" value={`R${selected.total_paid}`} />
          <p className="mt-1 text-xs leading-relaxed text-[#4a4438]">
            Held securely and released to {selected.sitterName} 2 days after the sit ends, if nothing is
            disputed.
          </p>
        </Section>

        <Section icon="↩" title="Cancellation policy">
          <p className="text-xs leading-relaxed text-[#4a4438]">
            Free cancellation up to 72 hours before the sit starts. Within 72 hours, R
            {Math.round(selected.sitting_fee * 0.5 * 100) / 100} (50% of the sitting fee) goes to{" "}
            {selected.sitterName} as compensation; the remaining amount is refunded to you.
          </p>
        </Section>

        <Section icon="🚨" title="Emergency plan">
          {selected.pets.map((p) => (
            <p key={p.id} className="text-xs leading-relaxed text-[#4a4438]">
              {p.name}&apos;s vet: {p.vet_name || "Not provided"}
              {p.vet_phone ? `, ${p.vet_phone}` : ""}
            </p>
          ))}
          <p className="mt-1 text-xs leading-relaxed text-[#4a4438]">
            {selected.sitterHasLicense === null
              ? `${selected.sitterName} hasn't provided transport details yet.`
              : selected.sitterHasLicense
                ? `${selected.sitterName} has their own transport for vet emergencies.`
                : `${selected.sitterName} doesn't drive — backup plan: ${
                    selected.sitterBackupDriver || "not provided"
                  }.`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#4a4438]">
            Sittr&apos;s SOS system is available if {selected.sitterName} cannot continue the sit.
          </p>
        </Section>

        <div className="mb-2.5 rounded-2xl border border-[#E8B892] bg-[#FBEAE8] p-3.5">
          <h4 className="mb-2 font-serif text-sm font-semibold text-ink">⚖️ Liability</h4>
          <p className="text-xs leading-relaxed text-[#8a4a2f]">
            Sittr verifies identity and conducts background checks but does not guarantee outcomes and is
            not an insurer. Both parties acknowledge the inherent risks of pet care arrangements. Full
            terms in the Sittr Terms of Service.
          </p>
        </div>

        <div className="mt-2 mb-4 rounded-2xl border-[1.5px] border-forest bg-white p-4">
          <div className="mb-3 flex items-start gap-2.5">
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
              I have read and agree to this booking agreement and Sittr&apos;s{" "}
              <span className="font-bold text-forest">Terms of Service</span>.
            </p>
          </div>
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Type your full name"
            className="w-full rounded-lg border-[1.5px] border-dashed border-line bg-[#fafaf8] px-3 py-2.5 text-center font-serif text-sm text-forest outline-none"
          />
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!canContinue || saving}
          onClick={handleAgree}
          className="w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Agree & continue to payment"}
        </button>
      </div>
    </div>
  );
}
