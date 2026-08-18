"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { submitIdDocument } from "@/lib/upload-id-document";

type Status = "not_started" | "pending" | "verified" | "rejected";

export default function IdVerificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("not_started");
  const [note, setNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      setUserId(uid);

      const { data } = await supabase
        .from("profiles")
        .select("id_verification_status, id_verification_note")
        .eq("id", uid)
        .single();

      if (data) {
        setStatus(data.id_verification_status as Status);
        setNote(data.id_verification_note);
      }
      setLoading(false);
    })();
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;

    setUploading(true);
    setError(null);

    const { error: submitError } = await submitIdDocument(file, userId);

    setUploading(false);

    if (submitError) return setError(submitError);

    setStatus("pending");
  }

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper pb-8">
      <div className="flex items-center gap-3 px-5 pt-4">
        <button
          type="button"
          onClick={() => router.push("/parent/browse")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-sm"
        >
          ←
        </button>
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink">Verify your identity</h1>
          <p className="text-xs text-muted">Confirms who you are — never shown to sitters, just a verified badge</p>
        </div>
      </div>

      <div className="px-5 pt-5">
        {status === "verified" ? (
          <div className="rounded-2xl bg-[#E4EEE9] p-4 text-center">
            <p className="text-sm font-bold text-forest">✅ You&apos;re verified</p>
          </div>
        ) : status === "pending" ? (
          <div className="rounded-2xl bg-[#F3E3D6] p-4 text-center">
            <p className="text-sm font-bold text-terracotta">⏳ Under review</p>
            <p className="mt-1 text-xs leading-relaxed text-terracotta">Usually takes 1–3 days.</p>
          </div>
        ) : (
          <>
            {status === "rejected" && (
              <div className="mb-4 rounded-2xl bg-[#FDECE3] p-4">
                <p className="text-sm font-bold text-terracotta">Your last submission wasn&apos;t approved</p>
                {note && <p className="mt-1 text-xs leading-relaxed text-terracotta">{note}</p>}
                <p className="mt-1 text-xs leading-relaxed text-terracotta">Please upload a new document.</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-line bg-white p-4 text-left disabled:opacity-60"
            >
              <span className="text-2xl">🪪</span>
              <div>
                <h4 className="mb-0.5 text-sm font-bold text-ink">
                  {uploading ? "Uploading…" : "Upload ID document"}
                </h4>
                <p className="text-xs text-muted">A driver&apos;s license, passport, or SA ID</p>
              </div>
            </button>

            <p className="mt-4 rounded-xl bg-[#F1EEE6] px-3.5 py-3 text-xs leading-relaxed text-muted">
              Owner verification is lighter than a sitter&apos;s — ID only, no criminal check — since
              sitters are unsupervised in your home, not the other way around.
            </p>

            {error && (
              <p className="mt-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
