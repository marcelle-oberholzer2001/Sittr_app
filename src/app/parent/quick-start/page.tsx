"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SERVICE_NAMES } from "@/lib/pet-services";
import { SUBURB_SUGGESTIONS } from "@/lib/suburbs";
import { supabase } from "@/lib/supabase/client";

interface Pet {
  id: string;
  name: string;
  species: string | null;
  size: string | null;
}

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export default function ParentQuickStartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petIds, setPetIds] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(() => isoDaysFromNow(7));
  const [dateTo, setDateTo] = useState(() => isoDaysFromNow(9));
  const [service, setService] = useState<string>("Overnight / sleepover");
  const [departureVisits, setDepartureVisits] = useState<1 | 2>(2);
  const [arrivalVisits, setArrivalVisits] = useState<1 | 2>(2);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }

      const { data } = await supabase.from("pets").select("id, name, species, size").eq("owner_id", uid);
      if (data) {
        setPets(data);
        if (data.length > 0) setPetIds([data[0].id]);
      }
      setLoading(false);
    })();
  }, []);

  function togglePet(id: string) {
    setPetIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  const needsBoundaryDayQuestions = service === "2x daily visits" && dateFrom !== dateTo;
  const fromLabel = formatDisplayDate(dateFrom);
  const toLabel = formatDisplayDate(dateTo);

  function search() {
    const params = new URLSearchParams({ location, from: dateFrom, to: dateTo, service });
    if (petIds.length > 0) params.set("petIds", petIds.join(","));
    if (needsBoundaryDayQuestions) {
      params.set("departureVisits", String(departureVisits));
      params.set("arrivalVisits", String(arrivalVisits));
    }
    router.push(`/parent/browse?${params.toString()}`);
  }

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  if (pets.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
        <div className="mb-3 text-3xl">🐾</div>
        <h1 className="mb-2 font-serif text-xl font-semibold text-ink">Add a pet first</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">
          We need to know the basics — species, size, breed — so we only show you sitters who are
          actually comfortable with your pet.
        </p>
        <button
          type="button"
          onClick={() => router.push("/parent/pet-passport?redirect=/parent/quick-start")}
          className="rounded-2xl bg-forest px-6 py-3.5 text-sm font-bold text-white"
        >
          Add a pet
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper pb-8">
      <div className="flex items-center justify-between px-5 pt-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Find a sitter</h1>
          <p className="mt-1 text-sm text-muted">
            Tell us what you need — we&apos;ll only show sitters who actually match.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/parent/browse")}
          className="shrink-0 text-sm font-bold text-muted"
        >
          Skip →
        </button>
      </div>

      <div className="mx-5 mt-4 rounded-[20px] border border-line bg-white p-[18px]">
        <div className="mb-4">
          <label className="mb-2 block text-[0.7rem] font-extrabold tracking-wide text-muted uppercase">
            Which pet(s)?
          </label>
          <div className="flex flex-wrap gap-2">
            {pets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePet(p.id)}
                className={`rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold ${
                  petIds.includes(p.id) ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                }`}
              >
                {p.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => router.push("/parent/pet-passport?redirect=/parent/quick-start")}
              className="rounded-full border-[1.5px] border-dashed border-line bg-white px-3.5 py-2 text-xs font-bold text-forest"
            >
              + Add another pet
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-[0.7rem] font-extrabold tracking-wide text-muted uppercase">
            Location
          </label>
          <div className="relative">
            <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-line px-3.5 py-3">
              <span>📍</span>
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder={location || "Search a suburb"}
                className="w-full text-sm font-bold text-ink outline-none"
              />
            </div>
            {locationQuery.length > 0 && (
              <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border-[1.5px] border-line bg-white shadow-lg">
                {SUBURB_SUGGESTIONS.filter((s) => s.toLowerCase().includes(locationQuery.toLowerCase())).map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setLocation(s);
                        setLocationQuery("");
                      }}
                      className="block w-full border-b border-line px-3.5 py-2.5 text-left text-xs text-ink last:border-b-0 hover:bg-[#F1EEE6]"
                    >
                      📍 {s}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-[0.7rem] font-extrabold tracking-wide text-muted uppercase">
            Dates
          </label>
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl border-[1.5px] border-line px-3 py-2.5">
              <div className="text-[0.65rem] font-bold text-muted">FROM</div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-0.5 w-full text-sm font-extrabold text-ink outline-none"
              />
            </div>
            <div className="flex-1 rounded-xl border-[1.5px] border-line px-3 py-2.5">
              <div className="text-[0.65rem] font-bold text-muted">TO</div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-0.5 w-full text-sm font-extrabold text-ink outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[0.7rem] font-extrabold tracking-wide text-muted uppercase">
            What kind of care?
          </label>
          <div className="flex flex-wrap gap-2">
            {SERVICE_NAMES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setService(s)}
                className={`rounded-xl border-[1.5px] px-3 py-2.5 text-center text-xs font-bold ${
                  service === s ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                }`}
                style={{ flexBasis: "calc(50% - 4px)" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {needsBoundaryDayQuestions && (
        <div className="mx-5 mt-3.5 rounded-[20px] border-[1.5px] border-terracotta bg-white p-[18px]">
          <div className="mb-1 text-[0.68rem] font-extrabold tracking-wide text-terracotta uppercase">
            Your first and last day
          </div>
          <p className="mb-3.5 text-xs leading-relaxed text-muted">
            You&apos;re probably not away the full day when you leave or come back — let your sitter know
            how many visits you actually need on those two days.
          </p>

          <div className="mb-3.5">
            <label className="mb-1.5 block text-xs font-bold text-ink">On {fromLabel} (the day you leave)</label>
            <div className="flex gap-2">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDepartureVisits(n)}
                  className={`flex-1 rounded-xl border-[1.5px] py-2.5 text-sm font-bold ${
                    departureVisits === n
                      ? "border-forest bg-forest text-white"
                      : "border-line bg-white text-ink"
                  }`}
                >
                  {n} visit{n > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-ink">On {toLabel} (the day you return)</label>
            <div className="flex gap-2">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setArrivalVisits(n)}
                  className={`flex-1 rounded-xl border-[1.5px] py-2.5 text-sm font-bold ${
                    arrivalVisits === n ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                  }`}
                >
                  {n} visit{n > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mx-5 mt-3.5 rounded-2xl bg-[#E4EEE9] p-3.5">
        <div className="mb-1 text-[0.68rem] font-extrabold tracking-wide text-forest uppercase">
          How matching works
        </div>
        <p className="text-xs leading-relaxed text-forest">
          {location ? (
            <>
              Only sitters who (1) cover {location}, (2) offer &quot;{service},&quot; and (3) are
              comfortable with {petIds.length > 1 ? "all your selected pets" : "your pet"} will appear —
              and you&apos;ll only see their {service} rate, not their other prices.
            </>
          ) : (
            "Choose a location above to see sitters who actually cover your area."
          )}
        </p>
      </div>

      <div className="mx-5 mt-4">
        <button
          type="button"
          disabled={petIds.length === 0 || !location}
          onClick={search}
          className="w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white disabled:opacity-40"
        >
          Search sitters →
        </button>
      </div>
    </div>
  );
}
