"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload-photo";

type VerificationStatus = "not_started" | "pending" | "verified";

export default function ParentProfilePage() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [idStatus, setIdStatus] = useState<VerificationStatus>("not_started");
  const [isSitter, setIsSitter] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      setUserId(uid);

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("full_name, phone, emergency_contact, id_verification_status, avatar_url, is_sitter")
        .eq("id", uid)
        .single();

      if (!fetchError && data) {
        setName(data.full_name ?? "");
        setPhone(data.phone ?? "");
        setEmergencyContact(data.emergency_contact ?? "");
        setIdStatus(data.id_verification_status as VerificationStatus);
        setAvatarUrl(data.avatar_url ?? null);
        setIsSitter(data.is_sitter ?? false);
      }
      setLoading(false);
    })();
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;

    setUploadingAvatar(true);
    setError(null);

    const ext = file.name.split(".").pop() || "jpg";
    const { url, error: uploadError } = await uploadPhoto(file, `${userId}/avatar.${ext}`);

    setUploadingAvatar(false);

    if (uploadError) return setError(uploadError);

    setAvatarUrl(url);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  async function handleSaveProfile() {
    if (!userId) return;
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: name,
        phone,
        emergency_contact: emergencyContact,
        avatar_url: avatarUrl,
      })
      .eq("id", userId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setIsEditing(false);
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
        <h1 className="font-serif text-xl font-semibold text-ink">My profile</h1>
      </div>

      <div className="px-5 pt-4">
        <div className="mb-4 flex items-center gap-3">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-terracotta font-serif text-2xl font-semibold text-white">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              (name || "S").charAt(0).toUpperCase()
            )}
          </div>
          {isEditing && (
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => avatarInputRef.current?.click()}
              className="rounded-xl border-[1.5px] border-dashed border-line bg-white px-3.5 py-2.5 text-xs font-bold text-ink disabled:opacity-60"
            >
              {uploadingAvatar ? "Uploading…" : avatarUrl ? "Change photo" : "Add a photo"}
            </button>
          )}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-serif text-base font-semibold text-ink">Your details</h4>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border-[1.5px] border-line bg-white px-3.5 py-2 text-xs font-bold text-ink"
            >
              ✏️ Edit profile
            </button>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Full name</label>
          {isEditing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="As sitters will see it"
              className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
            />
          ) : (
            <p className="text-sm text-muted italic">{name || "Not added yet."}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Phone number</label>
          {isEditing ? (
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="082 000 0000"
              className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
            />
          ) : (
            <p className="text-sm text-muted italic">{phone || "Not added yet."}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Emergency contact</label>
          {isEditing ? (
            <>
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Name and phone number"
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
              />
              <p className="mt-1 text-xs text-muted">Used only if a sitter can&apos;t reach you during a booking.</p>
            </>
          ) : (
            <p className="text-sm text-muted italic">{emergencyContact || "Not added yet."}</p>
          )}
        </div>

        <div
          className={`mt-2 flex items-center gap-2 rounded-xl px-3.5 py-3 ${
            idStatus === "verified" ? "bg-[#E4EEE9]" : "bg-[#F3E3D6]"
          }`}
        >
          <span className="text-lg">{idStatus === "verified" ? "✅" : idStatus === "pending" ? "⏳" : "🪪"}</span>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-ink">Identity verification</h4>
            <p className={`text-xs ${idStatus === "verified" ? "text-forest" : "text-terracotta"}`}>
              {idStatus === "verified"
                ? "Verified — you can send booking requests"
                : idStatus === "pending"
                  ? "Under review — usually 1–3 days"
                  : "Not verified yet"}
            </p>
          </div>
          {idStatus === "not_started" && (
            <button
              type="button"
              onClick={() => router.push("/parent/id-verification")}
              className="shrink-0 rounded-lg bg-terracotta px-2.5 py-1.5 text-[0.65rem] font-bold text-white"
            >
              Verify now
            </button>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Owner verification is lighter than a sitter&apos;s — ID only, no criminal check — since sitters
          are unsupervised in your home, not the other way around.
        </p>

        {!isSitter && (
          <div className="mt-4 rounded-2xl border-[1.5px] border-dashed border-line bg-white p-4">
            <h4 className="mb-1 text-sm font-bold text-ink">🐾 Want to sit for other pets too?</h4>
            <p className="mb-3 text-xs leading-relaxed text-muted">
              Your account can be both — a pet parent and a sitter. Switch between them anytime from Home.
            </p>
            <button
              type="button"
              onClick={() => router.push("/sitter/onboarding")}
              className="w-full rounded-2xl border-[1.5px] border-forest py-3 text-xs font-bold text-forest"
            >
              Become a sitter
            </button>
          </div>
        )}

        {isEditing && (
          <>
            {error && (
              <p className="mt-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveProfile}
              className="mt-5 w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </>
        )}

        {!isEditing && (
          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 w-full rounded-2xl border-[1.5px] border-line bg-white py-3.5 text-sm font-bold text-terracotta"
          >
            Log out
          </button>
        )}
      </div>
    </div>
  );
}
