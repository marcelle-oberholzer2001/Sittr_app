"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function HomeDetailsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [dustbinDay, setDustbinDay] = useState("");
  const [notes, setNotes] = useState("");

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
        .from("owner_home_details")
        .select("access_code, wifi_password, dustbin_day, household_notes")
        .eq("owner_id", uid)
        .maybeSingle();

      if (data) {
        setAccessCode(data.access_code ?? "");
        setWifiPassword(data.wifi_password ?? "");
        setDustbinDay(data.dustbin_day ?? "");
        setNotes(data.household_notes ?? "");
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    setError(null);

    const { error: upsertError } = await supabase.from("owner_home_details").upsert({
      owner_id: userId,
      access_code: accessCode,
      wifi_password: wifiPassword,
      dustbin_day: dustbinDay,
      household_notes: notes,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
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
        <h1 className="font-serif text-xl font-semibold text-ink">Home details</h1>
      </div>

      <p className="px-5 pt-3 text-sm leading-relaxed text-muted">
        For house sitting or drop-ins. Needed so a confirmed sitter knows how to take care of things
        while they&apos;re there.
      </p>

      <div className="px-5 pt-4">
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Alarm code / access instructions</label>
          <input
            type="text"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="e.g. gate code, key location"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">WiFi password</label>
          <input
            type="text"
            value={wifiPassword}
            onChange={(e) => setWifiPassword(e.target.value)}
            placeholder="For overnight sitters"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Dustbin day</label>
          <input
            type="text"
            value={dustbinDay}
            onChange={(e) => setDustbinDay(e.target.value)}
            placeholder="e.g. Tuesday"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-ink">Other household notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. cleaner comes Thursdays, don't use the front gate after 6pm"
            className="w-full resize-none rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
          />
        </div>

        <p className="mb-3 rounded-xl bg-[#F1EEE6] px-3.5 py-3 text-xs leading-relaxed text-forest">
          🔒 Everything here only unlocks for a sitter you&apos;ve actually got a booking with.
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
          {saving ? "Saving…" : "Save home details"}
        </button>
      </div>
    </div>
  );
}
