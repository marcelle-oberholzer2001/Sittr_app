"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const PERSONALITY_TAGS = ["Friendly", "Shy", "Energetic", "Anxious", "Nervous with strangers"];

const inputClass =
  "w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink";

interface PetForm {
  id: string;
  name: string;
  summary: string;
  age: string;
  personality: string[];
  feeding: string;
  medication: string;
  allergies: string;
  walkingRoutine: string;
  sleepingLocation: string;
  behaviourNotes: string;
  vetName: string;
  saved: boolean;
}

interface CopySource {
  id: string;
  name: string;
  feeding: string;
  medication: string;
  allergies: string;
  walkingRoutine: string;
  sleepingLocation: string;
  behaviourNotes: string;
  vetName: string;
}

function PetDetailsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const petIds = (searchParams.get("petIds") ?? searchParams.get("petId") ?? "")
    .split(",")
    .filter(Boolean);
  const redirectTo = searchParams.get("redirect") || "/home";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pets, setPets] = useState<PetForm[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySources, setCopySources] = useState<CopySource[]>([]);

  useEffect(() => {
    if (petIds.length === 0) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    (async () => {
      const { data, error: fetchError } = await supabase.from("pets").select("*").in("id", petIds);

      if (fetchError || !data || data.length === 0) {
        setLoading(false);
        setNotFound(true);
        return;
      }

      setPets(
        data.map((p) => ({
          id: p.id,
          name: p.name,
          summary: [p.breed, p.size, p.species].filter(Boolean).join(" · "),
          age: p.age ?? "",
          personality: p.personality ?? [],
          feeding: p.feeding ?? "",
          medication: p.medication ?? "",
          allergies: p.allergies ?? "",
          walkingRoutine: p.walking_routine ?? "",
          sleepingLocation: p.sleeping_location ?? "",
          behaviourNotes: p.behaviour_notes ?? "",
          vetName: p.vet_name ?? "",
          saved: false,
        })),
      );
      setLoading(false);

      const ownerId = data[0].owner_id;
      const { data: siblingData } = await supabase
        .from("pets")
        .select(
          "id, name, feeding, medication, allergies, walking_routine, sleeping_location, behaviour_notes, vet_name",
        )
        .eq("owner_id", ownerId);

      if (siblingData) {
        setCopySources(
          siblingData
            .filter((p) => p.feeding || p.sleeping_location || p.vet_name)
            .map((p) => ({
              id: p.id,
              name: p.name,
              feeding: p.feeding ?? "",
              medication: p.medication ?? "",
              allergies: p.allergies ?? "",
              walkingRoutine: p.walking_routine ?? "",
              sleepingLocation: p.sleeping_location ?? "",
              behaviourNotes: p.behaviour_notes ?? "",
              vetName: p.vet_name ?? "",
            })),
        );
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [searchParams.get("petIds"), searchParams.get("petId")]);

  const active = pets[activeIndex];

  function updateActive(patch: Partial<PetForm>) {
    setPets((prev) => prev.map((p, i) => (i === activeIndex ? { ...p, ...patch } : p)));
  }

  function copyFrom(source: CopySource) {
    updateActive({
      feeding: source.feeding,
      medication: source.medication,
      allergies: source.allergies,
      walkingRoutine: source.walkingRoutine,
      sleepingLocation: source.sleepingLocation,
      behaviourNotes: source.behaviourNotes,
      vetName: source.vetName,
    });
  }

  function togglePersonality(tag: string) {
    if (!active) return;
    updateActive({
      personality: active.personality.includes(tag)
        ? active.personality.filter((t) => t !== tag)
        : [...active.personality, tag],
    });
  }

  async function handleSave() {
    if (!active) return;
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("pets")
      .update({
        age: active.age || null,
        personality: active.personality,
        feeding: active.feeding || null,
        medication: active.medication || null,
        allergies: active.allergies || null,
        walking_routine: active.walkingRoutine || null,
        sleeping_location: active.sleepingLocation || null,
        behaviour_notes: active.behaviourNotes || null,
        vet_name: active.vetName || null,
      })
      .eq("id", active.id);

    setSaving(false);

    if (updateError) return setError(updateError.message);

    const updatedPets = pets.map((p, i) => (i === activeIndex ? { ...p, saved: true } : p));
    setPets(updatedPets);

    const nextUnsavedIndex = updatedPets.findIndex((p) => !p.saved);
    if (nextUnsavedIndex !== -1) {
      setActiveIndex(nextUnsavedIndex);
    } else {
      router.push(redirectTo);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  if (notFound || !active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <p className="text-sm text-muted">Pet not found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper pb-8">
      <div className="px-5 pt-4">
        <h2 className="font-serif text-xl font-semibold text-ink">Finish {active.name}&apos;s profile</h2>
        <p className="mt-1 mb-3.5 text-sm leading-relaxed text-muted">
          {active.summary} — sitters see this before accepting, and it&apos;s never typed again for
          future bookings.
        </p>
      </div>

      {pets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-5 pb-1">
          {pets.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold whitespace-nowrap ${
                i === activeIndex ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
              }`}
            >
              {p.saved && "✓ "}
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="px-5 pt-3 pb-4">
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Age</label>
          <input
            type="text"
            value={active.age}
            onChange={(e) => updateActive({ age: e.target.value })}
            placeholder="e.g. 3 years"
            className={inputClass}
          />
        </div>

        <div className="mb-2 text-[0.68rem] font-extrabold tracking-wide text-terracotta uppercase">
          Personality
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {PERSONALITY_TAGS.map((tag) => {
            const on = active.personality.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => togglePersonality(tag)}
                className={`rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold ${
                  on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <div className="mb-2 text-[0.68rem] font-extrabold tracking-wide text-terracotta uppercase">
          Care routine
        </div>
        {copySources.filter((s) => s.id !== active.id).length > 0 && (
          <div className="mb-4 rounded-xl bg-[#F1EEE6] px-3.5 py-3">
            <p className="mb-2 text-xs font-bold text-ink">
              Same feeding, sleeping & vet as another pet?
            </p>
            <div className="flex flex-wrap gap-2">
              {copySources
                .filter((s) => s.id !== active.id)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => copyFrom(s)}
                    className="rounded-full border-[1.5px] border-forest bg-white px-3.5 py-2 text-xs font-bold text-forest"
                  >
                    Copy from {s.name}
                  </button>
                ))}
            </div>
          </div>
        )}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Feeding schedule</label>
          <textarea
            rows={2}
            value={active.feeding}
            onChange={(e) => updateActive({ feeding: e.target.value })}
            placeholder="e.g. 1 cup kibble, 7am and 6pm"
            className={`${inputClass} resize-none`}
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Medication (if any)</label>
          <input
            type="text"
            value={active.medication}
            onChange={(e) => updateActive({ medication: e.target.value })}
            placeholder="e.g. none"
            className={inputClass}
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Allergies</label>
          <input
            type="text"
            value={active.allergies}
            onChange={(e) => updateActive({ allergies: e.target.value })}
            placeholder="e.g. chicken"
            className={inputClass}
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Walking routine</label>
          <input
            type="text"
            value={active.walkingRoutine}
            onChange={(e) => updateActive({ walkingRoutine: e.target.value })}
            placeholder="e.g. 30 min, morning and evening"
            className={inputClass}
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Where they sleep</label>
          <input
            type="text"
            value={active.sleepingLocation}
            onChange={(e) => updateActive({ sleepingLocation: e.target.value })}
            placeholder="e.g. own bed, in the kitchen"
            className={inputClass}
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Behaviour notes</label>
          <textarea
            rows={2}
            value={active.behaviourNotes}
            onChange={(e) => updateActive({ behaviourNotes: e.target.value })}
            placeholder="e.g. jumps at the gate, doesn't like other dogs"
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="mb-2 text-[0.68rem] font-extrabold tracking-wide text-terracotta uppercase">Vet</div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-ink">Vet name</label>
          <input
            type="text"
            value={active.vetName}
            onChange={(e) => updateActive({ vetName: e.target.value })}
            placeholder="Clinic name"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Just the name — sitters can look up the address if they need it.
          </p>
        </div>
      </div>

      <div className="px-5">
        {error && (
          <p className="mb-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : pets.filter((p) => !p.saved).length > 1
              ? `Save & continue (${pets.filter((p) => !p.saved).length} pets left)`
              : "Save details"}
        </button>
      </div>
    </div>
  );
}

export default function PetDetailsPage() {
  return (
    <Suspense>
      <PetDetailsForm />
    </Suspense>
  );
}
