"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Role = "sitter" | "parent";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole: Role = searchParams.get("role") === "parent" ? "parent" : "sitter";

  const [role, setRole] = useState<Role>(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!fullName.trim()) return setError("Please enter your name.");
    if (!email.trim()) return setError("Please enter your email.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setLoading(false);
      return setError(signUpError.message);
    }

    const userId = data.user?.id;
    if (!userId) {
      setLoading(false);
      return setError("Account created, but no session was returned. Try logging in.");
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: fullName.trim(),
      is_sitter: role === "sitter",
      is_owner: role === "parent",
    });

    setLoading(false);

    if (profileError) {
      return setError(profileError.message);
    }

    router.push(role === "sitter" ? "/sitter/onboarding" : "/parent/quick-start");
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper px-6 pt-14 pb-10">
      <h1 className="mb-1 font-serif text-2xl font-semibold text-ink">Create your account</h1>
      <p className="mb-6 text-sm leading-relaxed text-muted">
        Signing up as {role === "sitter" ? "a sitter" : "a pet parent"}. You can add the other role
        later from your profile.
      </p>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setRole("parent")}
          className={`flex-1 rounded-xl border-[1.5px] py-2.5 text-xs font-bold ${
            role === "parent" ? "border-terracotta bg-[#F3E3D6] text-terracotta" : "border-line bg-white text-muted"
          }`}
        >
          I need a sitter
        </button>
        <button
          type="button"
          onClick={() => setRole("sitter")}
          className={`flex-1 rounded-xl border-[1.5px] py-2.5 text-xs font-bold ${
            role === "sitter" ? "border-forest bg-[#E3EAE6] text-forest" : "border-line bg-white text-muted"
          }`}
        >
          I want to sit
        </button>
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-bold text-ink">Full name</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
        />
      </div>
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
          placeholder="At least 6 characters"
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
        {loading ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-xs text-muted">
        Already have an account?{" "}
        <button type="button" onClick={() => router.push("/login")} className="font-bold text-terracotta">
          Log in
        </button>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
