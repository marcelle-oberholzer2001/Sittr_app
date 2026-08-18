"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { SPECIES, DOG_SIZES, type SpeciesKey, type DogSize } from "@/lib/species";
import { DOG_BREEDS } from "@/lib/breeds";
import { supabase } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload-photo";

interface Pet {
  id: string;
  name: string;
  species: SpeciesKey | null;
  size: DogSize | null;
  breed: string;
  photoUrl: string | null;
}

function newPet(): Pet {
  return { id: crypto.randomUUID(), name: "", species: null, size: null, breed: "", photoUrl: null };
}

const inputClass =
  "w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink";

function PetPassportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/home";

  const [pets, setPets] = useState<Pet[]>(() => [newPet()]);
  const [activeId, setActiveId] = useState(() => pets[0].id);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = pets.find((p) => p.id === activeId) ?? pets[0];

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setUploading(false);
      return setError("You need to be logged in to add a photo.");
    }

    const ext = file.name.split(".").pop() || "jpg";
    const { url, error: uploadError } = await uploadPhoto(file, `${uid}/pets/${active.id}.${ext}`);

    setUploading(false);

    if (uploadError) return setError(uploadError);

    updateActive({ photoUrl: url });
  }

  function updateActive(patch: Partial<Pet>) {
    setPets((prev) => prev.map((p) => (p.id === activeId ? { ...p, ...patch } : p)));
  }

  function addPet() {
    const pet = newPet();
    setPets((prev) => [...prev, pet]);
    setActiveId(pet.id);
  }

  function removePet(id: string) {
    const remaining = pets.filter((p) => p.id !== id);
    const nextPets = remaining.length === 0 ? [newPet()] : remaining;
    setPets(nextPets);
    if (id === activeId) setActiveId(nextPets[0].id);
  }

  async function handleSave() {
    setError(null);

    const missingName = pets.find((p) => !p.name.trim());
    if (missingName) return setError("Every pet needs a name before you can save.");

    const missingSpecies = pets.find((p) => !p.species);
    if (missingSpecies) {
      return setError(`Please choose a species for ${missingSpecies.name || "each pet"}.`);
    }

    const missingSize = pets.find((p) => p.species === "dog" && !p.size);
    if (missingSize) {
      return setError(`Please choose a size for ${missingSize.name || "each dog"} — sitters filter by it.`);
    }

    setSaving(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const ownerId = userData.user?.id;
    if (userError || !ownerId) {
      setSaving(false);
      return setError("You need to be logged in to save pets.");
    }

    const rows = pets.map((p) => ({
      id: p.id,
      owner_id: ownerId,
      name: p.name.trim(),
      species: p.species,
      size: p.size,
      breed: p.breed || null,
      photo_url: p.photoUrl,
    }));

    const { error: insertError } = await supabase.from("pets").insert(rows);

    setSaving(false);

    if (insertError) return setError(insertError.message);

    router.push(redirectTo);
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="px-5 pt-4">
        <h2 className="font-serif text-xl font-semibold text-ink">Tell us about your pets</h2>
        <p className="mt-1 mb-3.5 text-sm leading-relaxed text-muted">
          Just the basics for now, so we can match you to sitters who are comfortable with your pet.
          You&apos;ll fill in the rest — feeding, medication, vet details — once you&apos;re booking a sit.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto px-5 pb-1">
        {pets.map((pet, i) => (
          <button
            key={pet.id}
            type="button"
            onClick={() => setActiveId(pet.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold whitespace-nowrap ${
              pet.id === activeId ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
            }`}
          >
            {pet.name || `Pet ${i + 1}`}
            {pets.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removePet(pet.id);
                }}
              >
                ✕
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={addPet}
          className="shrink-0 rounded-full border-[1.5px] border-dashed border-line bg-white px-3.5 py-2 text-xs font-bold whitespace-nowrap text-forest"
        >
          + Add another pet
        </button>
      </div>

      <div className="flex-1 px-5 pt-3 pb-4">
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Pet photo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-line bg-white p-4 text-left disabled:opacity-60"
          >
            {active.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.photoUrl} alt={active.name} className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <span className="text-2xl">🐾</span>
            )}
            <div>
              <h4 className="mb-0.5 text-sm font-bold text-ink">
                {uploading ? "Uploading…" : active.photoUrl ? "Photo added" : "Add a photo"}
              </h4>
              <p className="text-xs text-muted">Helps sitters recognise them instantly</p>
            </div>
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Name</label>
          <input
            type="text"
            value={active.name}
            onChange={(e) => updateActive({ name: e.target.value })}
            placeholder="e.g. Bella"
            className={inputClass}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Species</label>
          <div className="flex flex-wrap gap-2">
            {SPECIES.map((s) => {
              const on = active.species === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() =>
                    updateActive({
                      species: s.key,
                      size: s.key === "dog" ? active.size : null,
                      breed: s.key === active.species ? active.breed : "",
                    })
                  }
                  className={`rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold ${
                    on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                  }`}
                >
                  {s.icon} {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {active.species === "dog" && (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold text-ink">Size</label>
            <div className="flex flex-wrap gap-2">
              {DOG_SIZES.map((size) => {
                const on = active.size === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => updateActive({ size })}
                    className={`rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold ${
                      on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {active.species === "dog" && (
          <div>
            <label className="mb-1.5 block text-xs font-bold text-ink">Breed</label>
            <select
              value={active.breed}
              onChange={(e) => updateActive({ breed: e.target.value })}
              className={inputClass}
            >
              <option value="">Select a breed</option>
              {DOG_BREEDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="px-5 pb-6">
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
          {saving ? "Saving…" : `Save ${pets.length > 1 ? `${pets.length} pets` : "pet"}`}
        </button>
      </div>
    </div>
  );
}

export default function PetPassportPage() {
  return (
    <Suspense>
      <PetPassportForm />
    </Suspense>
  );
}
