"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) return setError("Please enter your email and password.");

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) return setError(signInError.message);

    router.push("/home");
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper px-6 pt-14 pb-10">
      <h1 className="mb-1 font-serif text-2xl font-semibold text-ink">Welcome back</h1>
      <p className="mb-6 text-sm leading-relaxed text-muted">Log in to your Sittr account.</p>

      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-bold text-ink">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
        />
      </div>
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-bold text-ink">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
        />
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={handleSubmit}
        className="mb-4 w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-50"
      >
        {loading ? "Logging in…" : "Log in"}
      </button>

      <p className="text-center text-xs text-muted">
        Don&apos;t have an account?{" "}
        <button type="button" onClick={() => router.push("/")} className="font-bold text-terracotta">
          Sign up
        </button>
      </p>
    </div>
  );
}
