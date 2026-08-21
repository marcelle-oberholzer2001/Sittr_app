"use client";

import { useRouter } from "next/navigation";

export default function SitterWelcomePage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-paper px-6 pt-16 pb-8 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-forest text-3xl text-white">
        ✓
      </div>
      <h1 className="mb-2 font-serif text-2xl font-semibold text-ink">You&apos;re all set!</h1>
      <p className="mx-auto mb-6 max-w-xs text-sm leading-relaxed text-muted">
        Your application is in. Here&apos;s what happens next.
      </p>

      <div className="mb-4 rounded-2xl border-[1.5px] border-line bg-white p-5 text-left">
        <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-forest bg-forest text-xs text-white">
            ✓
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink">ID verification</h4>
            <p className="text-xs text-muted">Verified</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-line text-xs text-muted">
            ·
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink">Background check</h4>
            <p className="text-xs text-muted">Optional — not started</p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-[#E4EEE9] px-4 py-3 text-xs leading-relaxed font-bold text-forest">
        ✅ You&apos;re live — owners searching in your coverage areas can already find and book you.
      </div>

      <button
        type="button"
        onClick={() => router.push("/home")}
        className="mb-3 w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white"
      >
        Back to home
      </button>
      <button
        type="button"
        onClick={() => router.push("/parent/quick-start")}
        className="w-full rounded-2xl border-[1.5px] border-line py-4 text-sm font-bold text-ink"
      >
        🐾 While you wait, browse as a pet parent
      </button>
    </div>
  );
}
