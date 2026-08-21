"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { rateForServiceLabel } from "@/lib/pet-services";
import type { Sitter } from "@/lib/sitters";
import { supabase } from "@/lib/supabase/client";

interface PetOption {
  id: string;
  name: string;
  feeding: string | null;
}

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export function RequestSheet({
  sitter,
  service,
  petIds: petIdsProp,
  dateFrom: dateFromProp,
  dateTo: dateToProp,
  onClose,
}: {
  sitter: Sitter;
  service: string;
  petIds?: string[] | null;
  dateFrom?: string;
  dateTo?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const sitterFirstName = sitter.name.split(" ")[0];
  const datesFixed = Boolean(dateFromProp && dateToProp);
  const petsFixed = Boolean(petIdsProp && petIdsProp.length > 0);

  const [requestSent, setRequestSent] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pets, setPets] = useState<PetOption[]>([]);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>(petIdsProp ?? []);
  const [dateFrom, setDateFrom] = useState(() => dateFromProp ?? isoDaysFromNow(7));
  const [dateTo, setDateTo] = useState(() => dateToProp ?? isoDaysFromNow(9));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      setUserId(uid);

      const { data: petsData } = await supabase
        .from("pets")
        .select("id, name, feeding")
        .eq("owner_id", uid);

      if (petsData) {
        setPets(petsData);
        if (!petIdsProp || petIdsProp.length === 0) {
          setSelectedPetIds(petsData.map((p) => p.id));
        }
      }
    })();
  }, [petIdsProp]);

  function togglePet(id: string) {
    setSelectedPetIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  const selectedPets = pets.filter((p) => selectedPetIds.includes(p.id));
  const selectedPetNames = selectedPets.map((p) => p.name).join(", ");
  const petComplete = selectedPets.length > 0 && selectedPets.every((p) => p.feeding !== null);
  const incompletePets = selectedPets.filter((p) => p.feeding === null);

  const remaining = petComplete ? 0 : 1;

  const rateStr = rateForServiceLabel(sitter.rates, service);
  const sittingFee = rateStr ? Number(rateStr.replace(/[^\d.]/g, "")) : null;
  const platformFee = sittingFee !== null ? Math.round(sittingFee * 0.1 * 100) / 100 : null;
  const totalPaid = sittingFee !== null && platformFee !== null ? sittingFee + platformFee : null;

  const canSend = remaining === 0 && selectedPetIds.length > 0 && sittingFee !== null && dateTo >= dateFrom;

  function goToPetDetails() {
    if (incompletePets.length === 0) return;
    let returnTo = "/home";
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("requesting", "1");
      returnTo = url.pathname + url.search;
    }
    const ids = incompletePets.map((p) => p.id).join(",");
    router.push(`/parent/pet-passport/details?petIds=${ids}&redirect=${encodeURIComponent(returnTo)}`);
  }

  async function handleSend() {
    setError(null);

    if (!userId) return setError("You need to be logged in to send a request.");
    if (selectedPetIds.length === 0) return setError("Add a pet before requesting a booking.");
    if (sittingFee === null) {
      return setError(`${sitterFirstName} hasn't set a rate for ${service} yet, so this can't be sent yet.`);
    }
    if (dateTo < dateFrom) return setError("Your return date can't be before your start date.");

    setSubmitting(true);

    const { data: booking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        sitter_id: sitter.id,
        owner_id: userId,
        service_type: service,
        date_from: dateFrom,
        date_to: dateTo,
        sitting_fee: sittingFee,
        platform_fee: platformFee,
        total_paid: totalPaid,
      })
      .select()
      .single();

    if (insertError || !booking) {
      setSubmitting(false);
      return setError(insertError?.message ?? "Something went wrong creating the booking.");
    }

    const { error: petsLinkError } = await supabase
      .from("booking_pets")
      .insert(selectedPetIds.map((petId) => ({ booking_id: booking.id, pet_id: petId })));

    setSubmitting(false);

    if (petsLinkError) return setError(petsLinkError.message);

    setRequestSent(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-ink/50"
      onClick={onClose}
    >
      <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-[26px] bg-paper p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />

        {requestSent ? (
          <div className="py-4 text-center">
            <div className="mb-3 text-3xl">✓</div>
            <h3 className="mb-1.5 font-serif text-xl font-semibold text-ink">Request sent!</h3>
            <p className="mb-5 text-sm leading-relaxed text-muted">
              {sitterFirstName} will get back to you soon. You&apos;ll be notified as soon as she
              responds.
            </p>
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="mb-1.5 font-serif text-xl font-semibold text-ink">Almost there</h3>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Before we send your request to {sitterFirstName}, they need to know who&apos;s asking —
              this takes about 2 minutes.
            </p>

            <div>
              <div className="flex items-center gap-3 border-b border-line py-3.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-forest bg-forest text-xs text-white">
                  ✓
                </div>
                <div className="flex-1">
                  <h4 className="mb-0.5 text-sm font-bold text-ink">Basic details</h4>
                  <p className="text-xs text-muted">Name & phone — done at signup</p>
                </div>
              </div>

              <div
                onClick={!petComplete && incompletePets.length > 0 ? goToPetDetails : undefined}
                className={`flex items-center gap-3 py-3.5 ${
                  !petComplete && incompletePets.length > 0 ? "cursor-pointer" : ""
                }`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                    petComplete
                      ? "border-forest bg-forest text-white"
                      : "border-terracotta font-extrabold text-terracotta"
                  }`}
                >
                  {petComplete ? "✓" : "!"}
                </div>
                <div className="flex-1">
                  <h4 className="mb-0.5 text-sm font-bold text-ink">
                    {petComplete ? "Pet details complete" : "Complete pet details"}
                  </h4>
                  <p className="text-xs text-muted">
                    {selectedPetNames
                      ? petComplete
                        ? `Feeding, vet info & more for ${selectedPetNames}`
                        : `Still needed for ${incompletePets.map((p) => p.name).join(", ")}`
                      : "Add a pet before requesting"}
                  </p>
                </div>
                {!petComplete && incompletePets.length > 0 && <span className="text-muted">›</span>}
              </div>
            </div>

            {petsFixed ? (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F1EEE6] px-3.5 py-3 text-xs">
                <span className="font-bold text-ink">Pet{selectedPetIds.length > 1 ? "s" : ""}</span>
                <span className="text-muted">{selectedPetNames}</span>
              </div>
            ) : (
              pets.length > 0 && (
                <div className="mt-4 mb-1">
                  <label className="mb-1.5 block text-xs font-bold text-ink">Which pets?</label>
                  <div className="flex flex-wrap gap-2">
                    {pets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePet(p.id)}
                        className={`rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold ${
                          selectedPetIds.includes(p.id)
                            ? "border-forest bg-forest text-white"
                            : "border-line bg-white text-ink"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}

            {datesFixed ? (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F1EEE6] px-3.5 py-3 text-xs">
                <span className="font-bold text-ink">Dates</span>
                <span className="text-muted">
                  {formatDisplayDate(dateFrom)} – {formatDisplayDate(dateTo)}
                </span>
              </div>
            ) : (
              <div className="mt-4 flex gap-2.5">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-bold text-ink">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-bold text-ink">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink"
                  />
                </div>
              </div>
            )}

            {remaining === 0 &&
              (sittingFee !== null ? (
                <div className="mt-4 rounded-xl bg-[#F1EEE6] px-3.5 py-3 text-xs leading-relaxed text-ink">
                  <div className="flex justify-between">
                    <span>Sitting fee</span>
                    <span className="font-bold">R{sittingFee}</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Platform fee (10%)</span>
                    <span>R{platformFee}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-line pt-1 font-bold">
                    <span>Total</span>
                    <span>R{totalPaid}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
                  {sitterFirstName} hasn&apos;t set a rate for {service} yet.
                </p>
              ))}

            {error && (
              <p className="mt-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={!canSend || submitting}
              onClick={handleSend}
              className="mt-4 w-full rounded-2xl bg-forest py-3.5 text-sm font-bold text-white disabled:bg-line disabled:text-muted"
            >
              {submitting
                ? "Sending…"
                : remaining > 0
                  ? `Complete ${remaining} step${remaining > 1 ? "s" : ""} to send request`
                  : "Send request"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
