"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface PendingProfile {
  id: string;
  fullName: string;
  isSitter: boolean;
  isOwner: boolean;
  documentPath: string | null;
  documentUrl: string | null;
}

function isImagePath(path: string) {
  return /\.(png|jpe?g|webp|gif)$/i.test(path);
}

export default function AdminVerificationsPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, setPending] = useState<PendingProfile[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", uid).single();
    if (!me?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, is_sitter, is_owner, id_document_path")
      .eq("id_verification_status", "pending");

    const withUrls = await Promise.all(
      (profiles ?? []).map(async (p) => {
        let documentUrl: string | null = null;
        if (p.id_document_path) {
          const { data } = await supabase.storage
            .from("id-documents")
            .createSignedUrl(p.id_document_path, 300);
          documentUrl = data?.signedUrl ?? null;
        }
        return {
          id: p.id,
          fullName: p.full_name || "Unnamed",
          isSitter: p.is_sitter,
          isOwner: p.is_owner,
          documentPath: p.id_document_path,
          documentUrl,
        };
      }),
    );

    setPending(withUrls);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    setProcessingId(id);
    setError(null);

    const { error: rpcError } = await supabase.rpc("review_id_verification", {
      p_user_id: id,
      p_approve: true,
      p_note: null,
    });

    setProcessingId(null);

    if (rpcError) return setError(rpcError.message);

    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    setError(null);

    const { error: rpcError } = await supabase.rpc("review_id_verification", {
      p_user_id: id,
      p_approve: false,
      p_note: rejectNote.trim() || null,
    });

    setProcessingId(null);

    if (rpcError) return setError(rpcError.message);

    setRejectingId(null);
    setRejectNote("");
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <p className="text-sm text-muted">You don&apos;t have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper pb-8">
      <div className="px-5 pt-4">
        <h1 className="font-serif text-xl font-semibold text-ink">ID verification review</h1>
        <p className="text-xs text-muted">{pending.length} waiting for review</p>
      </div>

      {error && (
        <p className="mx-5 mt-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
          {error}
        </p>
      )}

      <div className="px-5 pt-4">
        {pending.length === 0 ? (
          <p className="rounded-2xl border-[1.5px] border-dashed border-line bg-white px-3.5 py-6 text-center text-xs text-muted">
            Nothing waiting for review.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.map((p) => (
              <div key={p.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="mb-2">
                  <div className="font-serif text-sm font-semibold text-ink">{p.fullName}</div>
                  <div className="text-xs text-muted">
                    {[p.isSitter && "Sitter", p.isOwner && "Owner"].filter(Boolean).join(" & ")}
                  </div>
                </div>

                {p.documentUrl ? (
                  p.documentPath && isImagePath(p.documentPath) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.documentUrl}
                      alt={`${p.fullName}'s ID document`}
                      className="mb-3 max-h-80 w-full rounded-xl border border-line object-contain"
                    />
                  ) : (
                    <a
                      href={p.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-3 block rounded-xl border border-line bg-[#F1EEE6] px-3.5 py-3 text-center text-xs font-bold text-forest"
                    >
                      📄 Open document
                    </a>
                  )
                ) : (
                  <p className="mb-3 rounded-xl bg-[#F1EEE6] px-3.5 py-3 text-xs text-muted">
                    No document on file.
                  </p>
                )}

                {rejectingId === p.id ? (
                  <div>
                    <textarea
                      rows={2}
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Why is this being rejected? (shown to them)"
                      className="mb-2 w-full resize-none rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={processingId === p.id}
                        onClick={() => handleReject(p.id)}
                        className="flex-1 rounded-xl bg-terracotta py-2.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {processingId === p.id ? "Saving…" : "Confirm reject"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(null)}
                        className="flex-1 rounded-xl border-[1.5px] border-line py-2.5 text-xs font-bold text-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={processingId === p.id}
                      onClick={() => handleApprove(p.id)}
                      className="flex-1 rounded-xl bg-forest py-2.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {processingId === p.id ? "Saving…" : "✓ Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={processingId === p.id}
                      onClick={() => setRejectingId(p.id)}
                      className="flex-1 rounded-xl border-[1.5px] border-terracotta py-2.5 text-xs font-bold text-terracotta disabled:opacity-50"
                    >
                      ✕ Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
