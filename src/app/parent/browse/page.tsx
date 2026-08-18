"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { initialFor, avatarColorFor, type Sitter } from "@/lib/sitters";
import { rateForServiceLabel } from "@/lib/pet-services";
import { comfortableLabelFor } from "@/lib/species";
import { RequestSheet } from "@/components/RequestSheet";
import { supabase } from "@/lib/supabase/client";
import { computeTrustScores } from "@/lib/trust-score";

function unitFor(service: string) {
  if (service.includes("visit")) return "/ visit";
  if (service.includes("Daytime") || service.includes("daycare") || service.includes("2x")) return "/ day";
  if (service.includes("Overnight") || service.includes("Boarding")) return "/ night";
  if (service.includes("walking")) return "/ walk";
  return "/ day";
}

function formatDisplayDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

interface FilterChip {
  label: string;
  test: (s: Sitter) => boolean;
}

const FILTER_CHIPS: FilterChip[] = [
  { label: "All sitters", test: () => true },
  { label: "✔ Verified", test: (s) => s.verified === "verified" },
  { label: "🩹 First Aid", test: (s) => s.badges.some((b) => b.includes("First Aid")) },
];

function BrowseSittersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawLocation = searchParams.get("location");
  const location = rawLocation || "your area";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";
  const service = searchParams.get("service") ?? "Overnight / sleepover";
  const petIds = searchParams.get("petIds")?.split(",").filter(Boolean) ?? [];
  const departureVisits = searchParams.get("departureVisits");
  const arrivalVisits = searchParams.get("arrivalVisits");
  const hasBoundaryDayPrefs = departureVisits !== null && arrivalVisits !== null;

  const [requestingSitter, setRequestingSitter] = useState<Sitter | null>(null);
  const [activeFilter, setActiveFilter] = useState("All sitters");
  const [sitters, setSitters] = useState<Sitter[]>([]);
  const [loading, setLoading] = useState(true);
  const [petNames, setPetNames] = useState<string[]>([]);
  const [requiredComfortLabels, setRequiredComfortLabels] = useState<string[]>([]);
  const [unavailableSitterIds, setUnavailableSitterIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      if (petIds.length > 0) {
        const { data: pets } = await supabase.from("pets").select("name, species, size").in("id", petIds);
        if (pets) {
          setPetNames(pets.map((p) => p.name));
          setRequiredComfortLabels([...new Set(pets.map((p) => comfortableLabelFor(p.species, p.size)))]);
        }
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, bio, coverage_areas, services, comfortable_with, rates, avatar_url")
        .eq("is_sitter", true);

      if (!error && data) {
        const sitterIds = data.map((row) => row.id);
        const { data: reviewsData } =
          sitterIds.length > 0
            ? await supabase
                .from("reviews")
                .select("reviewee_id, rating")
                .in("reviewee_id", sitterIds)
                .eq("is_public", true)
            : { data: [] as { reviewee_id: string; rating: number }[] };

        if (sitterIds.length > 0 && dateFrom && dateTo) {
          const [blockedRes, bookingsRes] = await Promise.all([
            supabase
              .from("sitter_blocked_dates")
              .select("sitter_id")
              .in("sitter_id", sitterIds)
              .gte("date", dateFrom)
              .lte("date", dateTo),
            supabase
              .from("bookings")
              .select("sitter_id")
              .in("sitter_id", sitterIds)
              .in("status", ["accepted", "agreed", "paid"])
              .lte("date_from", dateTo)
              .gte("date_to", dateFrom),
          ]);
          setUnavailableSitterIds(
            new Set([
              ...(blockedRes.data ?? []).map((r) => r.sitter_id),
              ...(bookingsRes.data ?? []).map((r) => r.sitter_id),
            ]),
          );
        } else {
          setUnavailableSitterIds(new Set());
        }

        const ratingsBySitter = new Map<string, number[]>();
        for (const r of reviewsData ?? []) {
          const list = ratingsBySitter.get(r.reviewee_id) ?? [];
          list.push(r.rating);
          ratingsBySitter.set(r.reviewee_id, list);
        }

        const trustScores = await computeTrustScores(sitterIds);

        setSitters(
          data.map((row) => {
            const ratings = ratingsBySitter.get(row.id) ?? [];
            return {
              id: row.id,
              name: row.full_name || "Sitter",
              initial: initialFor(row.full_name || "S"),
              avatarColor: avatarColorFor(row.id),
              avatarUrl: row.avatar_url ?? null,
              verified: "new" as const,
              distanceKm: null,
              rates: row.rates ?? {},
              rating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
              trustScore: trustScores.get(row.id)?.total,
              bio: row.bio || "",
              badges: [],
              coverageAreas: row.coverage_areas ?? [],
              services: row.services ?? [],
              comfortableWith: row.comfortable_with ?? [],
              reviews: [],
            };
          }),
        );
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("petIds"), searchParams.get("from"), searchParams.get("to")]);

  const activeChip = FILTER_CHIPS.find((c) => c.label === activeFilter) ?? FILTER_CHIPS[0];
  const matchedSitters = sitters.filter((s) => {
    if (unavailableSitterIds.has(s.id)) return false;
    if (rawLocation && !s.coverageAreas.includes(rawLocation)) return false;
    if (requiredComfortLabels.length > 0) {
      return requiredComfortLabels.every((label) => s.comfortableWith.includes(label));
    }
    return true;
  });
  const excludedCount = sitters.length - matchedSitters.length;
  const filteredSitters = matchedSitters.filter(activeChip.test);

  const fromLabel = dateFrom ? formatDisplayDate(dateFrom) : "";
  const toLabel = dateTo ? formatDisplayDate(dateTo) : "";

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold text-ink">
            {service} sitters · {location.split(",")[0]}
          </h2>
          <span className="shrink-0 rounded-full bg-[#E4EEE9] px-2.5 py-1 text-[0.65rem] font-bold text-forest">
            🛡 Verified network
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {petNames.length > 0 && <>For {petNames.join(", ")} · </>}
          {fromLabel && toLabel ? `${fromLabel} – ${toLabel}` : "Any dates"}
        </p>
        <button
          type="button"
          onClick={() => router.push("/parent/quick-start")}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#E4EEE9] px-3 py-1.5 text-xs font-bold text-forest"
        >
          ✏️ Edit search
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto px-5 pt-1 pb-2">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => setActiveFilter(chip.label)}
            className={`shrink-0 rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold whitespace-nowrap ${
              activeFilter === chip.label
                ? "border-forest bg-forest text-white"
                : "border-line bg-white text-ink"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {hasBoundaryDayPrefs && (
        <p className="mx-5 mb-3 rounded-xl bg-[#F3E3D6] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
          📋 {departureVisits} visit{departureVisits === "2" ? "s" : ""} on {fromLabel}, {arrivalVisits}{" "}
          visit{arrivalVisits === "2" ? "s" : ""} on {toLabel} — the sitter you request will see this.
          Exact pricing for mixed-visit days isn&apos;t calculated here yet; you&apos;ll confirm the final
          total with your sitter before paying.
        </p>
      )}

      <div className="mx-5 mt-3 mb-3 rounded-xl bg-[#E4EEE9] px-3.5 py-3 text-xs leading-relaxed text-forest">
        👀 You&apos;re browsing as a guest. Nothing is shared until you request a booking.
      </div>

      {!loading && filteredSitters.length === 0 && (
        <p className="mx-5 mb-3 rounded-xl border-[1.5px] border-dashed border-line bg-white px-3.5 py-4 text-center text-xs text-muted">
          No sitters match this filter right now.
        </p>
      )}

      <div className="flex flex-col gap-3 px-5 pb-3">
        {filteredSitters.map((sitter) => (
          <button
            key={sitter.id}
            type="button"
            onClick={() => {
              const params = new URLSearchParams({ service });
              if (petIds.length > 0) params.set("petIds", petIds.join(","));
              if (dateFrom) params.set("from", dateFrom);
              if (dateTo) params.set("to", dateTo);
              router.push(`/parent/sitter/${sitter.id}?${params.toString()}`);
            }}
            className="relative rounded-2xl border border-line bg-white p-3.5 text-left"
          >
            {fromLabel && toLabel && (
              <span className="absolute top-3.5 right-3.5 rounded-lg bg-[#E4EEE9] px-2 py-1 text-[0.62rem] font-extrabold text-forest">
                ✓ Free {fromLabel}–{toLabel}
              </span>
            )}
            <div className="flex items-center gap-3">
              <div
                className="flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-2xl font-serif text-lg font-semibold text-white"
                style={{ background: sitter.avatarColor }}
              >
                {sitter.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sitter.avatarUrl} alt={sitter.name} className="h-full w-full object-cover" />
                ) : (
                  sitter.initial
                )}
              </div>
              <div className="min-w-0 flex-1 pr-16">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif text-sm font-semibold text-ink">{sitter.name}</span>
                  {sitter.verified === "verified" ? (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-forest text-[0.55rem] text-white">
                      ✓
                    </span>
                  ) : (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-muted text-[0.55rem] text-white">
                      …
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center text-[0.7rem] text-muted">
                  {sitter.rating ? (
                    <span className="font-bold text-gold">★ {sitter.rating.toFixed(1)}</span>
                  ) : (
                    <span className="font-bold text-terracotta">✨ New</span>
                  )}
                  {sitter.distanceKm !== null && <> · {sitter.distanceKm} km</>}
                  {sitter.trustScore !== undefined && (
                    <span className="ml-1.5 flex items-center gap-0.5 rounded-md bg-[#E4EEE9] px-1.5 py-0.5 text-[0.62rem] font-bold text-forest">
                      🛡 {sitter.trustScore}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between rounded-lg bg-[#F1EEE6] px-2.5 py-2">
              <span className="text-xs font-bold text-forest">{service} rate</span>
              {rateForServiceLabel(sitter.rates, service) ? (
                <span className="flex items-baseline gap-1 font-serif text-sm font-semibold text-ink">
                  {rateForServiceLabel(sitter.rates, service)}
                  <span className="text-[0.6rem] font-semibold text-muted">{unitFor(service)}</span>
                </span>
              ) : (
                <span className="text-xs font-semibold text-muted italic">Rate not set yet</span>
              )}
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setRequestingSitter(sitter);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  setRequestingSitter(sitter);
                }
              }}
              className="mt-2.5 w-full rounded-xl bg-forest py-2.5 text-center text-xs font-bold text-white"
            >
              Request
            </div>
          </button>
        ))}
      </div>

      {!loading && excludedCount > 0 && (
        <p className="mx-5 mb-6 rounded-xl bg-[#F1EEE6] px-3.5 py-3 text-center text-xs leading-relaxed text-muted">
          {excludedCount} more sitter{excludedCount === 1 ? "" : "s"} {excludedCount === 1 ? "doesn't" : "don't"}{" "}
          cover {location.split(",")[0]}, aren&apos;t available for these dates, or aren&apos;t comfortable
          with {petNames.length > 0 ? petNames.join(", ") : "this pet"} — hidden from this search.
        </p>
      )}

      {requestingSitter && (
        <RequestSheet
          sitter={requestingSitter}
          service={service}
          petIds={petIds}
          dateFrom={dateFrom || undefined}
          dateTo={dateTo || undefined}
          onClose={() => setRequestingSitter(null)}
        />
      )}
    </div>
  );
}

export default function BrowseSittersPage() {
  return (
    <Suspense>
      <BrowseSittersContent />
    </Suspense>
  );
}
