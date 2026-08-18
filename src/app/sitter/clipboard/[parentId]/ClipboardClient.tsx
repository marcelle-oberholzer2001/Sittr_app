"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface ClipboardData {
  petId: string;
  parentName: string;
  parentPhone: string;
  petName: string;
  photoUrl: string | null;
  breed: string;
  age: string;
  size: string;
  personality: string;
  bookingService: string;
  bookingDates: string;
  feeding: string;
  allergies: string;
  medication: string;
  walkingRoutine: string;
  sleepingLocation: string;
  behaviourNotes: string;
  vetName: string;
  vetPhone: string;
  vetAddress: string;
  accessCode: string;
  wifiPassword: string;
  dustbinDay: string;
  householdNotes: string;
  meetGreetNotes: string;
}

function formatDateRange(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const fromStr = new Date(from).toLocaleDateString("en-ZA", opts);
  const toStr = new Date(to).toLocaleDateString("en-ZA", opts);
  return `${fromStr} – ${toStr}`;
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2.5 border-b border-line py-1.5 text-sm last:border-b-0">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-bold text-ink">{value}</span>
    </div>
  );
}

function ConfirmRow({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2.5 flex items-center gap-2 border-t border-dashed border-line pt-2.5"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] text-xs ${
          checked ? "border-forest bg-forest text-white" : "border-forest text-forest"
        }`}
      >
        {checked && "✓"}
      </span>
      <span className="text-xs font-bold text-forest">Confirmed at meet &amp; greet</span>
    </button>
  );
}

export default function ClipboardClient({ petId }: { petId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ClipboardData | null>(null);
  const [feedingConfirmed, setFeedingConfirmed] = useState(false);
  const [medicationConfirmed, setMedicationConfirmed] = useState(false);
  const [walkingConfirmed, setWalkingConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: pet, error: petError } = await supabase
        .from("pets")
        .select("*")
        .eq("id", petId)
        .single();

      if (petError || !pet) {
        setLoading(false);
        return;
      }

      const [ownerRes, homeRes, bookingPetRows] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("id", pet.owner_id).single(),
        supabase
          .from("owner_home_details")
          .select("access_code, wifi_password, dustbin_day, household_notes")
          .eq("owner_id", pet.owner_id)
          .maybeSingle(),
        supabase.from("booking_pets").select("booking_id").eq("pet_id", petId),
      ]);

      const bookingIds = (bookingPetRows.data ?? []).map((r) => r.booking_id);
      const bookingRes =
        bookingIds.length > 0
          ? await supabase
              .from("bookings")
              .select("service_type, date_from, date_to")
              .in("id", bookingIds)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : { data: null };

      setData({
        petId: pet.id,
        parentName: ownerRes.data?.full_name || "Pet parent",
        parentPhone: ownerRes.data?.phone || "Not provided",
        petName: pet.name,
        photoUrl: pet.photo_url ?? null,
        breed: pet.breed || "Not provided",
        age: pet.age || "Not provided",
        size: pet.size || "Not provided",
        personality:
          pet.personality && pet.personality.length > 0 ? pet.personality.join(", ") : "Not provided",
        bookingService: bookingRes.data?.service_type || "—",
        bookingDates: bookingRes.data
          ? formatDateRange(bookingRes.data.date_from, bookingRes.data.date_to)
          : "—",
        feeding: pet.feeding || "Not provided",
        allergies: pet.allergies || "Not provided",
        medication: pet.medication || "None provided",
        walkingRoutine: pet.walking_routine || "Not provided",
        sleepingLocation: pet.sleeping_location || "Not provided",
        behaviourNotes: pet.behaviour_notes || "Not provided",
        vetName: pet.vet_name || "Not provided",
        vetPhone: pet.vet_phone || "Not provided",
        vetAddress: pet.vet_address || "Not provided",
        accessCode: homeRes.data?.access_code || "Not provided",
        wifiPassword: homeRes.data?.wifi_password || "Not provided",
        dustbinDay: homeRes.data?.dustbin_day || "Not provided",
        householdNotes: homeRes.data?.household_notes || "Not provided",
        meetGreetNotes: pet.meet_greet_notes || "",
      });
      setNotes(pet.meet_greet_notes || "");
      setLoading(false);
    })();
  }, [petId]);

  async function handleSaveNotes() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const { error: updateError } = await supabase
      .from("pets")
      .update({ meet_greet_notes: notes })
      .eq("id", petId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
  }

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <p className="text-sm text-muted">Clipboard not found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper pb-8">
      <div className="px-5 pt-4">
        <button
          type="button"
          onClick={() => router.push("/sitter/clients")}
          className="mb-2 text-xs font-bold text-muted"
        >
          ← Booking with {data.parentName}
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-terracotta text-lg">
            {data.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photoUrl} alt={data.petName} className="h-full w-full object-cover" />
            ) : (
              "🐾"
            )}
          </div>
          <div>
            <h1 className="font-serif text-xl font-semibold text-ink">{data.petName}&apos;s Sit Clipboard</h1>
            <p className="mt-0.5 text-xs text-muted">
              {data.bookingService} · {data.bookingDates}
            </p>
          </div>
        </div>
      </div>

      <span className="mx-5 mt-3 mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-forest px-3 py-1.5 text-[0.68rem] font-bold text-white">
        📌 Available throughout the whole sit
      </span>
      <p className="mx-5 mb-1 rounded-xl bg-[#E4EEE9] px-3.5 py-2.5 text-xs leading-relaxed font-bold text-forest">
        Everything below is pulled straight from {data.parentName.split(" ")[0]}&apos;s saved profile for{" "}
        {data.petName} — she never has to retype this for you or any future sitter.
      </p>

      <div className="px-5 pt-4">
        <h3 className="mb-2 flex items-center gap-1.5 font-serif text-sm font-semibold text-ink">
          🐕 Basics
        </h3>
        <div className="mb-4 rounded-2xl border border-line bg-white p-3.5">
          <FactRow label="Breed" value={data.breed} />
          <FactRow label="Age" value={data.age} />
          <FactRow label="Size" value={data.size} />
          <FactRow label="Personality" value={data.personality} />
        </div>

        <h3 className="mb-2 flex items-center gap-1.5 font-serif text-sm font-semibold text-ink">
          🍽️ Feeding schedule
        </h3>
        <div className="mb-4 rounded-2xl border border-line bg-white p-3.5">
          <FactRow label="Feeding" value={data.feeding} />
          <FactRow label="Allergies" value={data.allergies} />
          <ConfirmRow checked={feedingConfirmed} onToggle={() => setFeedingConfirmed((v) => !v)} />
        </div>

        <h3 className="mb-2 flex items-center gap-1.5 font-serif text-sm font-semibold text-ink">
          💊 Medication
        </h3>
        <div className="mb-4 rounded-2xl border border-line bg-white p-3.5">
          <FactRow label="Current medication" value={data.medication} />
          <ConfirmRow checked={medicationConfirmed} onToggle={() => setMedicationConfirmed((v) => !v)} />
        </div>

        <h3 className="mb-2 flex items-center gap-1.5 font-serif text-sm font-semibold text-ink">
          🚶 Walking &amp; routine
        </h3>
        <div className="mb-4 rounded-2xl border border-line bg-white p-3.5">
          <FactRow label="Walks" value={data.walkingRoutine} />
          <FactRow label="Sleeping" value={data.sleepingLocation} />
          <FactRow label="Behaviour notes" value={data.behaviourNotes} />
          <ConfirmRow checked={walkingConfirmed} onToggle={() => setWalkingConfirmed((v) => !v)} />
        </div>

        <h3 className="mb-2 flex items-center gap-1.5 font-serif text-sm font-semibold text-ink">
          🏥 Vet &amp; emergency
        </h3>
        <div className="mb-4 rounded-2xl border-[1.5px] border-[#E8B892] bg-[#FDECE3] p-3.5">
          <div className="flex justify-between gap-2.5 border-b border-[#E8B892] py-1.5 text-sm">
            <span className="shrink-0 text-muted">Vet clinic</span>
            <span className="text-right font-bold text-[#B85C2E]">{data.vetName}</span>
          </div>
          <div className="flex justify-between gap-2.5 border-b border-[#E8B892] py-1.5 text-sm">
            <span className="shrink-0 text-muted">Phone</span>
            <span className="text-right font-bold text-[#B85C2E]">{data.vetPhone}</span>
          </div>
          <div className="flex justify-between gap-2.5 border-b border-[#E8B892] py-1.5 text-sm">
            <span className="shrink-0 text-muted">Address</span>
            <span className="text-right font-bold text-[#B85C2E]">{data.vetAddress}</span>
          </div>
          <div className="flex justify-between gap-2.5 py-1.5 text-sm">
            <span className="shrink-0 text-muted">Owner emergency contact</span>
            <span className="text-right font-bold text-[#B85C2E]">
              {data.parentName.split(" ")[0]} — {data.parentPhone}
            </span>
          </div>
        </div>

        <h3 className="mb-2 flex items-center gap-1.5 font-serif text-sm font-semibold text-ink">
          🔑 Home access
        </h3>
        <div className="mb-4 rounded-2xl border-[1.5px] border-dashed border-line bg-[#F1EEE6] p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-[0.68rem] font-extrabold tracking-wide text-terracotta uppercase">
            🔓 Unlocked for this confirmed booking only
          </div>
          <FactRow label="Gate/access code" value={data.accessCode} />
          <FactRow label="WiFi password" value={data.wifiPassword} />
          <FactRow label="Bin day" value={data.dustbinDay} />
          <FactRow label="Other notes" value={data.householdNotes} />
        </div>

        <h3 className="mb-2 flex items-center gap-1.5 font-serif text-sm font-semibold text-ink">
          ✏️ Notes from the meet &amp; greet
        </h3>
        <div className="mb-2 rounded-2xl border border-line bg-white p-3.5">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaved(false);
            }}
            placeholder="Anything mentioned that isn't already saved above"
            className="w-full resize-none rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none"
          />
        </div>
        {error && (
          <p className="mb-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={handleSaveNotes}
          className="mb-4 w-full rounded-2xl border-[1.5px] border-forest py-3 text-xs font-bold text-forest disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save notes"}
        </button>

        <p className="text-center text-xs leading-relaxed text-muted">
          This clipboard stays available for the whole sit — if you forget anything, it&apos;s here. Notes
          you save here go straight back to {data.petName}&apos;s profile, so they&apos;re ready if you (or
          another sitter) book with her again.
        </p>
      </div>
    </div>
  );
}
