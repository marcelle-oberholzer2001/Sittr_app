"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isValidSaIdNumber, submitIdNumber } from "@/lib/submit-id-number";

type Status = "not_started" | "verified";

export default function IdVerificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("not_started");
  const [idNumber, setIdNumber] = useState("");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id_verification_status")
        .eq("id", uid)
        .single();

      if (data) setStatus(data.id_verification_status as Status);
      setLoading(false);
    })();
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const { error: submitError } = await submitIdNumber(idNumber.trim());

    setSubmitting(false);

    if (submitError) return setError(submitError);

    setStatus("verified");
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
        ) : (
          <>
            <label className="mb-1.5 block text-xs font-bold text-ink">SA ID number</label>
            <input
              type="text"
              inputMode="numeric"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 13))}
              placeholder="13-digit ID number"
              className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
            />

            <button
              type="button"
              disabled={submitting || !isValidSaIdNumber(idNumber)}
              onClick={handleSubmit}
              className="mt-4 w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {submitting ? "Verifying…" : "Verify"}
            </button>

            <p className="mt-4 rounded-xl bg-[#F1EEE6] px-3.5 py-3 text-xs leading-relaxed text-muted">
              Owner verification is lighter than a sitter&apos;s — ID number only, no criminal check —
              since sitters are unsupervised in your home, not the other way around.
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
