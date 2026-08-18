"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SERVICES, DEFAULT_RATES, type ServiceKey } from "@/lib/pet-services";
import { supabase } from "@/lib/supabase/client";

export default function SetRatesPage() {
  const router = useRouter();
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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
        .select("rates")
        .eq("id", uid)
        .single();

      if (!fetchError && data?.rates && Object.keys(data.rates).length > 0) {
        setRates({ ...DEFAULT_RATES, ...data.rates });
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    setError(null);

    const services = SERVICES.filter((s) => rates[s.key].enabled).map((s) => s.label);

    const { error: updateError } = await supabase.from("profiles").update({ rates, services }).eq("id", userId);

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

  function toggleRate(key: ServiceKey) {
    setRates((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  }

  function setRateValue(key: ServiceKey, value: string) {
    setRates((prev) => ({ ...prev, [key]: { ...prev[key], rate: value } }));
  }

  const enabledLabels = SERVICES.filter((s) => rates[s.key].enabled).map((s) => s.label);
  const disabledLabels = SERVICES.filter((s) => !rates[s.key].enabled).map((s) => s.label);
  const screeningApplies = rates.boarding.enabled || rates.daycare.enabled;

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
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink">Set your rates</h1>
        </div>
      </div>

      <p className="px-5 pt-3 text-sm leading-relaxed text-muted">
        Turn on every service you want to offer, and set your own price for each one. Leave the rest off
        — owners will only ever see prices for services you&apos;ve actually turned on.
      </p>

      <div className="px-5 pt-4">
        {SERVICES.map((svc) => {
          const state = rates[svc.key];
          return (
            <div key={svc.key} className="mb-2.5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => toggleRate(svc.key)}
                className={`flex-[1.3] rounded-xl border-[1.5px] px-3 py-3 text-center text-xs font-bold ${
                  state.enabled
                    ? svc.clay
                      ? "border-terracotta bg-terracotta text-white"
                      : "border-forest bg-forest text-white"
                    : "border-line bg-white text-muted"
                }`}
              >
                {svc.label}
              </button>
              <div
                className={`flex flex-1 items-center gap-1 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 ${
                  state.enabled ? "" : "opacity-35"
                }`}
              >
                <span className="text-sm font-bold text-muted">R</span>
                <input
                  type="text"
                  value={state.rate}
                  onChange={(e) => setRateValue(svc.key, e.target.value)}
                  disabled={!state.enabled}
                  placeholder="—"
                  className="w-full text-sm font-extrabold text-ink outline-none disabled:pointer-events-none"
                />
                <span className="text-[0.68rem] font-semibold whitespace-nowrap text-muted">{svc.unit}</span>
              </div>
            </div>
          );
        })}

        <div className="mt-4 rounded-2xl bg-[#E4EEE9] p-3.5">
          <div className="mb-1 text-[0.7rem] font-extrabold tracking-wide text-forest uppercase">
            What this sitter just told us
          </div>
          <p className="text-xs leading-relaxed text-forest">
            {enabledLabels.length > 0
              ? `You offer ${enabledLabels.join(", ")} only.`
              : "You haven't turned on any services yet."}{" "}
            {disabledLabels.length > 0 &&
              `You'll never appear when an owner searches for ${disabledLabels.join(", ")}.`}{" "}
            {!screeningApplies &&
              "Since Boarding and Daycare are both off, no home-screening questions apply to you."}
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="mt-5 w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save rates"}
        </button>
      </div>
    </div>
  );
}
