"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PARTS = ["toeTL", "toeTR", "toeL", "toeR", "house"] as const;
type Part = (typeof PARTS)[number];
type Role = "parent" | "sitter";

const FOREST = "#1F3830";
const DIM = "#4C6B5B";
const LIT = "#F7F5F1";

const SPLASH_DURATION_MS = 1500;

export default function Home() {
  const router = useRouter();
  const [phase, setPhase] = useState<"splash" | "roles">("splash");
  const [lit, setLit] = useState<Part>(PARTS[0]);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    if (phase !== "splash") return;

    let i = 0;
    const pulse = setInterval(() => {
      i = (i + 1) % PARTS.length;
      setLit(PARTS[i]);
    }, 260);
    const advance = setTimeout(() => setPhase("roles"), SPLASH_DURATION_MS);

    return () => {
      clearInterval(pulse);
      clearTimeout(advance);
    };
  }, [phase]);

  const fill = (part: Part) => (lit === part ? LIT : DIM);

  return (
    <div className="relative min-h-screen">
      {/* Splash */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center px-4 transition-opacity duration-500 ${
          phase === "splash" ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ background: FOREST }}
      >
        <svg viewBox="0 0 220 220" className="h-36 w-36">
          <ellipse cx="95" cy="90" rx="17" ry="22" fill={fill("toeTL")} className="transition-colors duration-300 ease-in-out" />
          <ellipse cx="130" cy="90" rx="17" ry="22" fill={fill("toeTR")} className="transition-colors duration-300 ease-in-out" />
          <ellipse cx="68" cy="118" rx="15" ry="19" fill={fill("toeL")} className="transition-colors duration-300 ease-in-out" />
          <ellipse cx="157" cy="118" rx="15" ry="19" fill={fill("toeR")} className="transition-colors duration-300 ease-in-out" />
          <path
            d="M112 108 L156 144 L156 178 C156 184 151 189 145 189 L79 189 C73 189 68 184 68 178 L68 144 Z"
            fill={fill("house")}
            className="transition-colors duration-300 ease-in-out"
          />
          <path d="M97 189 L97 158 Q97 148 112 148 Q127 148 127 158 L127 189 Z" fill={FOREST} />
        </svg>
        <h1 className="mt-5 font-serif text-3xl font-semibold text-[#F7F5F1]">Sittr</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#9FB0A5]">Trusted Pet Care</p>
      </div>

      {/* Role select */}
      <div
        className={`absolute inset-0 flex flex-col bg-paper px-6 pt-14 pb-10 transition-opacity duration-500 ${
          phase === "roles" ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="mb-8 text-center">
          <h1 className="mb-2 font-serif text-2xl font-semibold text-ink">Welcome to Sittr</h1>
          <p className="text-sm leading-relaxed text-muted">
            Tell us why you&apos;re here today —<br />
            you can always add the other role later.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRole("parent")}
          className={`mb-4 flex items-center gap-4 rounded-[20px] border-[1.5px] bg-white p-5 text-left transition-colors active:scale-[0.98] ${
            role === "parent" ? "border-terracotta" : "border-line"
          }`}
        >
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[#F3E3D6]">
            <svg width="28" height="28" viewBox="0 0 28 28">
              <path d="M14 4 L24 10 V24 H4 V10 Z" fill="none" stroke="#C77A4E" strokeWidth="2.2" strokeLinejoin="round" />
              <circle cx="14" cy="17" r="3" fill="#C77A4E" />
            </svg>
          </span>
          <span>
            <h3 className="mb-0.5 font-serif text-base font-semibold text-ink">I need a sitter</h3>
            <p className="text-xs leading-snug text-muted">Find a trusted, verified sitter for your pet</p>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setRole("sitter")}
          className={`mb-4 flex items-center gap-4 rounded-[20px] border-[1.5px] bg-white p-5 text-left transition-colors active:scale-[0.98] ${
            role === "sitter" ? "border-forest" : "border-line"
          }`}
        >
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[#E3EAE6]">
            <svg width="28" height="28" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="10" fill="none" stroke="#2C4A3E" strokeWidth="2.2" />
              <path d="M9 14 L12.5 17.5 L19 10.5" fill="none" stroke="#2C4A3E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            <h3 className="mb-0.5 font-serif text-base font-semibold text-ink">I want to sit</h3>
            <p className="text-xs leading-snug text-muted">Get verified and start earning as a sitter</p>
          </span>
        </button>

        <div className="mt-1 rounded-2xl bg-[#EFEAE0] px-4 py-3 text-center text-xs leading-relaxed text-muted">
          🐾 <span className="font-semibold text-ink">Most people do both.</span> You can switch roles
          anytime from your profile — no need to create a second account.
        </div>

        <button
          type="button"
          disabled={!role}
          onClick={() => {
            if (role) router.push(`/signup?role=${role}`);
          }}
          className="mt-auto rounded-2xl bg-forest py-4 text-sm font-bold text-white transition-opacity disabled:opacity-40"
        >
          Continue
        </button>

        <p className="mt-4 text-center text-xs text-muted">
          Already have an account?{" "}
          <button type="button" onClick={() => router.push("/login")} className="font-bold text-terracotta">
            Log in
          </button>
        </p>
      </div>
    </div>
  );
}
