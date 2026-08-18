"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { SPECIES, DOG_SIZES, type SpeciesKey, type DogSize } from "@/lib/species";
import { DOG_BREEDS } from "@/lib/breeds";
import { supabase } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload-photo";

const inputClass =
  "w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink";

function EditPetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const petId = searchParams.get("petId");

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<SpeciesKey | null>(null);
  const [size, setSize] = useState<DogSize | null>(null);
  const [breed, setBreed] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!petId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    (async () => {
      const { data, error: fetchError } = await supabase.from("pets").select("*").eq("id", petId).single();

      if (fetchError || !data) {
        setLoading(false);
        setNotFound(true);
        return;
      }

      setName(data.name);
      setSpecies(data.species);
      setSize(data.size);
      setBreed(data.breed ?? "");
      setPhotoUrl(data.photo_url ?? null);
      setLoading(false);
    })();
  }, [petId]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !petId) return;

    setUploading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setUploading(false);
      return setError("You need to be logged in to change the photo.");
    }

    const ext = file.name.split(".").pop() || "jpg";
    const { url, error: uploadError } = await uploadPhoto(file, `${uid}/pets/${petId}.${ext}`);

    setUploading(false);

    if (uploadError) return setError(uploadError);

    setPhotoUrl(url);
  }

  async function handleSave() {
    if (!petId) return;
    setError(null);

    if (!name.trim()) return setError("Please give your pet a name.");
    if (!species) return setError("Please choose a species.");
    if (species === "dog" && !size) return setError("Please choose a size — sitters filter by it.");

    setSaving(true);

    const { error: updateError } = await supabase
      .from("pets")
      .update({
        name: name.trim(),
        species,
        size: species === "dog" ? size : null,
        breed: breed || null,
        photo_url: photoUrl,
      })
      .eq("id", petId);

    setSaving(false);

    if (updateError) return setError(updateError.message);

    router.push("/home");
  }

  async function handleDelete() {
    if (!petId) return;
    if (!window.confirm(`Remove ${name || "this pet"}? This can't be undone.`)) return;

    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase.from("pets").delete().eq("id", petId);

    setDeleting(false);

    if (deleteError) return setError(deleteError.message);

    router.push("/home");
  }

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <p className="text-sm text-muted">Pet not found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="flex items-center gap-3 px-5 pt-4">
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-sm"
        >
          ←
        </button>
        <h2 className="font-serif text-xl font-semibold text-ink">Edit {name || "pet"}</h2>
      </div>

      <div className="flex-1 px-5 pt-4 pb-4">
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
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={name} className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <span className="text-2xl">🐾</span>
            )}
            <div>
              <h4 className="mb-0.5 text-sm font-bold text-ink">
                {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Add a photo"}
              </h4>
              <p className="text-xs text-muted">Helps sitters recognise them instantly</p>
            </div>
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bella"
            className={inputClass}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Species</label>
          <div className="flex flex-wrap gap-2">
            {SPECIES.map((s) => {
              const on = species === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setSpecies(s.key);
                    if (s.key !== "dog") setSize(null);
                    if (s.key !== species) setBreed("");
                  }}
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

        {species === "dog" && (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold text-ink">Size</label>
            <div className="flex flex-wrap gap-2">
              {DOG_SIZES.map((s) => {
                const on = size === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold ${
                      on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {species === "dog" && (
          <div>
            <label className="mb-1.5 block text-xs font-bold text-ink">Breed</label>
            <select value={breed} onChange={(e) => setBreed(e.target.value)} className={inputClass}>
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
          disabled={saving || deleting}
          onClick={handleSave}
          className="mb-2.5 w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={saving || deleting}
          onClick={handleDelete}
          className="w-full rounded-2xl border-[1.5px] border-line py-3.5 text-sm font-bold text-terracotta disabled:opacity-50"
        >
          {deleting ? "Removing…" : "Remove this pet"}
        </button>
      </div>
    </div>
  );
}

export default function EditPetPage() {
  return (
    <Suspense>
      <EditPetForm />
    </Suspense>
  );
}
