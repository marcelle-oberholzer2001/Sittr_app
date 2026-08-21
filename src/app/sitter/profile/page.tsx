"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SPECIES, DOG_SIZES } from "@/lib/species";
import { SUBURB_SUGGESTIONS } from "@/lib/suburbs";
import { supabase } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload-photo";
import { uploadVideo } from "@/lib/upload-video";
import { isValidSaIdNumber, submitIdNumber } from "@/lib/submit-id-number";
import { computeTrustScores, type TrustScoreBreakdown } from "@/lib/trust-score";
import { fetchSitterPhotos, type SitterPhoto } from "@/lib/sitter-photos";
import { LANGUAGES, emptyReference, type SitterReference } from "@/lib/languages";

type VerificationStatus = "not_started" | "verified";

const DOG_SIZE_OPTIONS = DOG_SIZES.map((size) => `${size} dogs`);
const COMFORTABLE_OPTIONS = [
  ...DOG_SIZE_OPTIONS,
  ...SPECIES.filter((s) => s.key !== "dog").map((s) => s.pluralLabel),
];

function toggleInList(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface ReviewPreview {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
}

export default function SitterProfilePage() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<SitterPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPosition, setRemovingPosition] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [idStatus, setIdStatus] = useState<VerificationStatus>("not_started");
  const [submittingId, setSubmittingId] = useState(false);
  const [idNumber, setIdNumber] = useState("");
  const [idError, setIdError] = useState<string | null>(null);
  const [coverageAreas, setCoverageAreas] = useState<string[]>([]);
  const [suburbQuery, setSuburbQuery] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [comfortableWith, setComfortableWith] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [references, setReferences] = useState<SitterReference[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [becomingOwner, setBecomingOwner] = useState(false);
  const [reviews, setReviews] = useState<ReviewPreview[]>([]);
  const [trustScore, setTrustScore] = useState<TrustScoreBreakdown | null>(null);

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
        .select(
          "full_name, bio, coverage_areas, services, comfortable_with, id_verification_status, avatar_url, intro_video_url, is_owner, languages_spoken, sitter_references",
        )
        .eq("id", uid)
        .single();

      if (!fetchError && data) {
        setFullName(data.full_name ?? "");
        setBio(data.bio ?? "");
        setCoverageAreas(data.coverage_areas ?? []);
        setServices(data.services ?? []);
        setComfortableWith(data.comfortable_with ?? []);
        setIdStatus(data.id_verification_status as VerificationStatus);
        setAvatarUrl(data.avatar_url ?? null);
        setIntroVideoUrl(data.intro_video_url ?? null);
        setIsOwner(data.is_owner ?? false);
        setLanguages(data.languages_spoken ?? []);
        setReferences(
          data.sitter_references && data.sitter_references.length > 0
            ? data.sitter_references
            : [emptyReference()],
        );
      }

      setPhotos(await fetchSitterPhotos(uid));

      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("id, reviewer_id, rating, comment")
        .eq("reviewee_id", uid)
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      if (reviewsData && reviewsData.length > 0) {
        const reviewerIds = [...new Set(reviewsData.map((r) => r.reviewer_id))];
        const { data: reviewersData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", reviewerIds);
        const reviewersById = new Map((reviewersData ?? []).map((r) => [r.id, r]));

        setReviews(
          reviewsData.map((r) => ({
            id: r.id,
            reviewerName: reviewersById.get(r.reviewer_id)?.full_name || "A pet parent",
            rating: r.rating,
            comment: r.comment,
          })),
        );
      }

      const scores = await computeTrustScores([uid]);
      setTrustScore(scores.get(uid) ?? null);

      setLoading(false);
    })();
  }, []);

  async function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;

    setUploadingVideo(true);
    setError(null);

    const ext = file.name.split(".").pop() || "mp4";
    const { url, error: uploadError } = await uploadVideo(file, `${userId}/intro.${ext}`);

    if (uploadError) {
      setUploadingVideo(false);
      return setError(uploadError);
    }

    const { error: saveError } = await supabase.from("profiles").update({ intro_video_url: url }).eq("id", userId);

    setUploadingVideo(false);

    if (saveError) return setError(saveError.message);

    setIntroVideoUrl(url);
  }

  async function handleRemoveVideo() {
    if (!userId) return;
    setError(null);

    const { error: removeError } = await supabase
      .from("profiles")
      .update({ intro_video_url: null })
      .eq("id", userId);

    if (removeError) return setError(removeError.message);

    setIntroVideoUrl(null);
  }

  async function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;

    setUploadingPhoto(true);
    setError(null);

    const ext = file.name.split(".").pop() || "jpg";
    const { url, error: uploadError } = await uploadPhoto(file, `${userId}/gallery-${Date.now()}.${ext}`);

    if (uploadError) {
      setUploadingPhoto(false);
      return setError(uploadError);
    }

    const { error: addError } = await supabase.rpc("add_sitter_photo", { p_photo_url: url });

    setUploadingPhoto(false);

    if (addError) return setError(addError.message);

    const updated = await fetchSitterPhotos(userId);
    setPhotos(updated);
    setAvatarUrl(updated.find((p) => p.position === 1)?.photo_url ?? null);
  }

  async function handleRemovePhoto(position: number) {
    if (!userId) return;
    setRemovingPosition(position);
    setError(null);

    const { error: removeError } = await supabase.rpc("remove_sitter_photo", { p_position: position });

    setRemovingPosition(null);

    if (removeError) return setError(removeError.message);

    const updated = await fetchSitterPhotos(userId);
    setPhotos(updated);
    setAvatarUrl(updated.find((p) => p.position === 1)?.photo_url ?? null);
  }

  async function handleSubmitIdNumber() {
    setSubmittingId(true);
    setIdError(null);

    const { error: submitError } = await submitIdNumber(idNumber);

    setSubmittingId(false);

    if (submitError) return setIdError(submitError);

    setIdStatus("verified");
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  async function handleBecomeOwner() {
    if (!userId) return;
    setBecomingOwner(true);
    setError(null);

    const { error: updateError } = await supabase.from("profiles").update({ is_owner: true }).eq("id", userId);

    setBecomingOwner(false);

    if (updateError) return setError(updateError.message);

    router.push("/parent/pet-passport");
  }

  async function handleSaveProfile() {
    if (!userId) return;
    setSaving(true);
    setError(null);

    const filledReferences = references.filter((r) => r.name.trim());

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        bio,
        coverage_areas: coverageAreas,
        services,
        comfortable_with: comfortableWith,
        avatar_url: avatarUrl,
        languages_spoken: languages,
        sitter_references: filledReferences.length > 0 ? filledReferences : null,
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
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="relative h-36 shrink-0 bg-gradient-to-br from-[#3E6152] to-[#1F3830]">
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sm"
        >
          ←
        </button>
        {photos.length > 0 && (
          <span className="absolute right-4 bottom-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-ink">
            📷 {photos.length} photo{photos.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="relative -mt-10 px-5">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-paper bg-terracotta font-serif text-3xl font-semibold text-white">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
          ) : (
            (fullName || "S").charAt(0).toUpperCase()
          )}
        </div>

        <div className="mt-2.5 flex items-start justify-between">
          <div>
            <h1 className="font-serif text-xl font-semibold text-ink">{fullName || "New Sitter"}</h1>
            <p className="mt-1 text-xs text-muted">{coverageAreas[0] ?? "No coverage area set"}</p>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="shrink-0 rounded-full border-[1.5px] border-line bg-white px-3.5 py-2 text-xs font-bold text-ink"
            >
              ✏️ Edit profile
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-lg bg-[#F1EEE6] px-2 py-1 text-[0.66rem] font-bold text-forest">
            {idStatus === "verified" ? "✅ ID Verified" : "🪪 ID not submitted"}
          </span>
        </div>
        {idStatus === "not_started" && (
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 13))}
              placeholder="13-digit ID number"
              className="flex-1 rounded-lg border-[1.5px] border-line bg-white px-2.5 py-1.5 text-xs text-ink"
            />
            <button
              type="button"
              disabled={submittingId || !isValidSaIdNumber(idNumber)}
              onClick={handleSubmitIdNumber}
              className="shrink-0 rounded-lg bg-terracotta px-2.5 py-1.5 text-[0.66rem] font-bold text-white disabled:opacity-50"
            >
              {submittingId ? "Verifying…" : "Verify"}
            </button>
          </div>
        )}
        {idError && <p className="mt-2 text-xs leading-relaxed text-terracotta">{idError}</p>}

        {!isOwner && (
          <div className="mt-4 rounded-2xl border-[1.5px] border-dashed border-line bg-white p-4">
            <h4 className="mb-1 text-sm font-bold text-ink">🔍 Have pets of your own?</h4>
            <p className="mb-3 text-xs leading-relaxed text-muted">
              Your account can be both — a sitter and a pet parent. Switch between them anytime from Home.
            </p>
            <button
              type="button"
              disabled={becomingOwner}
              onClick={handleBecomeOwner}
              className="w-full rounded-2xl border-[1.5px] border-forest py-3 text-xs font-bold text-forest disabled:opacity-50"
            >
              {becomingOwner ? "Setting up…" : "Become a pet parent too"}
            </button>
          </div>
        )}
      </div>

      {trustScore && (
        <div className="px-5 pt-5">
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-base font-semibold text-ink">🛡 Trust Score</h4>
              <span className="font-serif text-2xl font-semibold text-forest">{trustScore.total}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              A combined score from your reviews, reliability, verification, experience, and repeat
              clients. Recalculated live, not just once.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { label: "Review quality", value: trustScore.review, weight: "30%" },
                { label: "Reliability", value: trustScore.reliability, weight: "25%" },
                { label: "Verification", value: trustScore.verification, weight: "20%" },
                { label: "Experience", value: trustScore.experience, weight: "15%" },
                { label: "Repeat clients", value: trustScore.repeat, weight: "10%" },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-2.5">
                  <span className="w-28 shrink-0 text-xs text-muted">
                    {c.label} <span className="text-[0.62rem]">({c.weight})</span>
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F1EEE6]">
                    <div
                      className="h-full rounded-full bg-forest"
                      style={{ width: `${Math.max(0, Math.min(100, c.value))}%` }}
                    />
                  </div>
                  <span className="w-7 shrink-0 text-right text-xs font-bold text-ink">{c.value}</span>
                </div>
              ))}
            </div>
            {trustScore.verification < 100 && (
              <p className="mt-3 text-[0.7rem] leading-relaxed text-muted italic">
                Verification only counts your ID check for now — background checks and certifications
                aren&apos;t part of the score yet.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="px-5 pt-5">
        <h4 className="mb-2 font-serif text-base font-semibold text-ink">Photos</h4>
        <p className="mb-2 text-xs text-muted">
          The first photo is your profile picture. Up to 5 total — owners see all of them.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.position} className="relative aspect-square overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photo_url} alt={`Photo ${p.position}`} className="h-full w-full object-cover" />
              {p.position === 1 && (
                <span className="absolute top-1 left-1 rounded-md bg-forest px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                  Profile
                </span>
              )}
              {isEditing && (
                <button
                  type="button"
                  disabled={removingPosition !== null}
                  onClick={() => handleRemovePhoto(p.position)}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-xs text-white disabled:opacity-50"
                >
                  {removingPosition === p.position ? "…" : "✕"}
                </button>
              )}
            </div>
          ))}
          {isEditing && photos.length < 5 && (
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => photoInputRef.current?.click()}
              className="flex aspect-square items-center justify-center rounded-xl border-[1.5px] border-dashed border-line bg-white text-2xl text-muted disabled:opacity-50"
            >
              {uploadingPhoto ? "…" : "+"}
            </button>
          )}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAddPhoto}
        />
        {photos.length === 0 && !isEditing && <p className="text-xs text-muted">No photos added yet.</p>}
      </div>

      <div className="px-5 pt-5">
        <h4 className="mb-2 font-serif text-base font-semibold text-ink">About you</h4>
        {isEditing ? (
          <textarea
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell owners a bit about yourself — your experience, why you love pet sitting, what makes you trustworthy..."
            className="w-full resize-none rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
          />
        ) : (
          <p className="text-sm leading-relaxed text-muted italic">{bio || "No bio added yet."}</p>
        )}
      </div>

      <div className="px-5 pt-5">
        <h4 className="mb-2 font-serif text-base font-semibold text-ink">Intro video</h4>
        {introVideoUrl ? (
          <div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={introVideoUrl} controls className="w-full rounded-2xl border border-line" />
            {isEditing && (
              <button
                type="button"
                onClick={handleRemoveVideo}
                className="mt-2 text-xs font-bold text-terracotta"
              >
                Remove video
              </button>
            )}
          </div>
        ) : isEditing ? (
          <>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoChange}
            />
            <button
              type="button"
              disabled={uploadingVideo}
              onClick={() => videoInputRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-line bg-white p-4 text-left disabled:opacity-60"
            >
              <span className="text-2xl">🎥</span>
              <div>
                <h5 className="mb-0.5 text-sm font-bold text-ink">
                  {uploadingVideo ? "Uploading…" : "Add a short intro video"}
                </h5>
                <p className="text-xs text-muted">
                  A 30–60 second video builds more trust than photos alone (max 50MB)
                </p>
              </div>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-line bg-white p-4">
            <span className="text-2xl">🎥</span>
            <p className="text-sm text-muted">No intro video added yet.</p>
          </div>
        )}
      </div>

      <div className="px-5 pt-5">
        <h4 className="mb-2 font-serif text-base font-semibold text-ink">Coverage areas</h4>
        {isEditing && (
          <div className="relative mb-2.5">
            <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink">
              🔍
              <input
                type="text"
                value={suburbQuery}
                onChange={(e) => setSuburbQuery(e.target.value)}
                placeholder="Search a suburb"
                className="w-full text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
            {suburbQuery.length > 0 && (
              <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border-[1.5px] border-line bg-white shadow-lg">
                {SUBURB_SUGGESTIONS.filter(
                  (s) => s.toLowerCase().includes(suburbQuery.toLowerCase()) && !coverageAreas.includes(s),
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setCoverageAreas((prev) => [...prev, s]);
                      setSuburbQuery("");
                    }}
                    className="block w-full border-b border-line px-3.5 py-2.5 text-left text-xs text-ink last:border-b-0 hover:bg-[#F1EEE6]"
                  >
                    📍 {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {coverageAreas.length === 0 && <p className="text-xs text-muted">No coverage areas added.</p>}
          {coverageAreas.map((a) =>
            isEditing ? (
              <button
                key={a}
                type="button"
                onClick={() => setCoverageAreas((prev) => prev.filter((x) => x !== a))}
                className="flex items-center gap-1.5 rounded-full border-[1.5px] border-forest bg-forest px-3 py-1.5 text-xs font-bold text-white"
              >
                {a} ✕
              </button>
            ) : (
              <span
                key={a}
                className="rounded-full border-[1.5px] border-forest bg-forest px-3 py-1.5 text-xs font-bold text-white"
              >
                {a}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-serif text-base font-semibold text-ink">Services offered</h4>
          {isEditing && (
            <button
              type="button"
              onClick={() => router.push("/sitter/rates")}
              className="text-xs font-bold text-forest underline"
            >
              Edit in Set your rates
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {services.map((s) => (
            <span
              key={s}
              className="rounded-full border-[1.5px] border-forest bg-forest px-3 py-1.5 text-xs font-bold text-white"
            >
              {s}
            </span>
          ))}
          {services.length === 0 && <p className="text-xs text-muted">No services selected.</p>}
        </div>
      </div>

      <div className="px-5 pt-5">
        <h4 className="mb-2 font-serif text-base font-semibold text-ink">Comfortable with</h4>
        <div className="flex flex-wrap gap-1.5">
          {(isEditing ? COMFORTABLE_OPTIONS : comfortableWith).map((c) => {
            const on = comfortableWith.includes(c);
            return isEditing ? (
              <button
                key={c}
                type="button"
                onClick={() => setComfortableWith((prev) => toggleInList(prev, c))}
                className={`rounded-full border-[1.5px] px-3 py-1.5 text-xs font-bold ${
                  on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                }`}
              >
                {c}
              </button>
            ) : (
              <span
                key={c}
                className="rounded-full border-[1.5px] border-forest bg-forest px-3 py-1.5 text-xs font-bold text-white"
              >
                {c}
              </span>
            );
          })}
          {!isEditing && comfortableWith.length === 0 && (
            <p className="text-xs text-muted">Nothing selected yet.</p>
          )}
        </div>
      </div>

      <div className="px-5 pt-5">
        <h4 className="mb-2 font-serif text-base font-semibold text-ink">Languages spoken</h4>
        <div className="flex flex-wrap gap-1.5">
          {(isEditing ? LANGUAGES : languages).map((l) => {
            const on = languages.includes(l);
            return isEditing ? (
              <button
                key={l}
                type="button"
                onClick={() => setLanguages((prev) => toggleInList(prev, l))}
                className={`rounded-full border-[1.5px] px-3 py-1.5 text-xs font-bold ${
                  on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                }`}
              >
                {l}
              </button>
            ) : (
              <span
                key={l}
                className="rounded-full border-[1.5px] border-forest bg-forest px-3 py-1.5 text-xs font-bold text-white"
              >
                {l}
              </span>
            );
          })}
          {!isEditing && languages.length === 0 && (
            <p className="text-xs text-muted">Nothing selected yet.</p>
          )}
        </div>
      </div>

      <div className="px-5 pt-5">
        <h4 className="mb-2 font-serif text-base font-semibold text-ink">References</h4>
        {isEditing ? (
          <>
            {references.map((ref, i) => (
              <div key={i} className="mb-2.5 rounded-2xl border-[1.5px] border-line bg-white p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Reference {i + 1}</span>
                  {references.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setReferences((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-xs font-bold text-terracotta"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={ref.name}
                  onChange={(e) =>
                    setReferences((prev) =>
                      prev.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)),
                    )
                  }
                  placeholder="Name"
                  className="mb-2 w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink"
                />
                <input
                  type="text"
                  value={ref.relationship}
                  onChange={(e) =>
                    setReferences((prev) =>
                      prev.map((r, idx) => (idx === i ? { ...r, relationship: e.target.value } : r)),
                    )
                  }
                  placeholder="Relationship — e.g. previous client, employer"
                  className="mb-2 w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink"
                />
                <input
                  type="text"
                  value={ref.contact}
                  onChange={(e) =>
                    setReferences((prev) =>
                      prev.map((r, idx) => (idx === i ? { ...r, contact: e.target.value } : r)),
                    )
                  }
                  placeholder="Phone or email"
                  className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink"
                />
              </div>
            ))}
            {references.length < 3 && (
              <button
                type="button"
                onClick={() => setReferences((prev) => [...prev, emptyReference()])}
                className="w-full rounded-2xl border-[1.5px] border-dashed border-line bg-white py-2.5 text-xs font-bold text-forest"
              >
                + Add another reference
              </button>
            )}
          </>
        ) : references.filter((r) => r.name.trim()).length === 0 ? (
          <p className="text-xs text-muted">No references added.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {references
              .filter((r) => r.name.trim())
              .map((r, i) => (
                <div key={i} className="rounded-2xl border border-line bg-white p-3.5">
                  <div className="text-sm font-bold text-ink">{r.name}</div>
                  <div className="text-xs text-muted">{r.relationship}</div>
                  <div className="text-xs text-muted">{r.contact}</div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="px-5 pt-5 pb-6">
        <div className="mb-2 flex items-center gap-2">
          <h4 className="font-serif text-base font-semibold text-ink">Reviews</h4>
          {reviews.length > 0 && (
            <>
              <span className="text-xs font-bold text-gold">
                ★ {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}
              </span>
              <span className="text-xs text-muted">({reviews.length})</span>
            </>
          )}
        </div>
        {reviews.length === 0 ? (
          <p className="text-xs text-muted">No reviews yet.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-line bg-white p-3.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">{r.reviewerName}</span>
                  <span className="text-xs font-bold text-gold">{"★".repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="text-xs leading-relaxed text-muted">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {isEditing && (
        <div className="px-5 pb-6">
          {error && (
            <p className="mb-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveProfile}
            className="w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      )}

      {!isEditing && (
        <div className="px-5 pb-6">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-2xl border-[1.5px] border-line bg-white py-3.5 text-sm font-bold text-terracotta"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
