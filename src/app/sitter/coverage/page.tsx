"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SUBURB_SUGGESTIONS } from "@/lib/suburbs";
import { supabase } from "@/lib/supabase/client";

export default function SitterCoveragePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [coverageAreas, setCoverageAreas] = useState<string[]>([]);
  const [suburbQuery, setSuburbQuery] = useState("");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      setUserId(uid);

      const { data } = await supabase.from("profiles").select("coverage_areas").eq("id", uid).single();
      setCoverageAreas(data?.coverage_areas ?? []);
      setLoading(false);
    })();
  }, []);

  function addCoverageArea(area: string) {
    setCoverageAreas((prev) => (prev.includes(area) ? prev : [...prev, area]));
    setSuburbQuery("");
  }

  function removeCoverageArea(area: string) {
    setCoverageAreas((prev) => prev.filter((a) => a !== area));
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ coverage_areas: coverageAreas })
      .eq("id", userId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/home");
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
        <h1 className="font-serif text-xl font-semibold text-ink">Coverage areas</h1>
      </div>

      <p className="px-5 pt-3 text-sm leading-relaxed text-muted">
        Search and add every suburb you&apos;re happy to travel to. No travel fees either way, so only
        add ones you&apos;d genuinely go to for free.
      </p>

      <div className="px-5 pt-4">
        <div className="relative mb-3">
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
                  onClick={() => addCoverageArea(s)}
                  className="block w-full border-b border-line px-3.5 py-2.5 text-left text-xs text-ink last:border-b-0 hover:bg-[#F1EEE6]"
                >
                  📍 {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="mb-1.5 block text-xs font-bold text-ink">Your coverage areas</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {coverageAreas.length === 0 && (
            <p className="text-xs text-muted">No areas added yet — search above to add one.</p>
          )}
          {coverageAreas.map((area) => (
            <span
              key={area}
              className="flex items-center gap-1.5 rounded-full border-[1.5px] border-forest bg-forest px-3.5 py-2 text-xs font-bold text-white"
            >
              {area}
              <button type="button" onClick={() => removeCoverageArea(area)} aria-label={`Remove ${area}`}>
                ✕
              </button>
            </span>
          ))}
        </div>

        <p className="mb-5 rounded-xl bg-[#E4EEE9] px-3.5 py-3 text-xs leading-relaxed text-forest">
          💡 Owners searching in any of these suburbs will see your profile. Your exact address is never
          shown — only the suburb names you add here.
        </p>

        {error && (
          <p className="mb-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save coverage areas"}
        </button>
      </div>
    </div>
  );
}
