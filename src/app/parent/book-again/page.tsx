"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { initialFor, avatarColorFor, type Sitter } from "@/lib/sitters";
import { RequestSheet } from "@/components/RequestSheet";

interface PastSitter {
  sitter: Sitter;
  lastService: string;
  lastDate: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export default function BookAgainPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pastSitters, setPastSitters] = useState<PastSitter[]>([]);
  const [requestingSitter, setRequestingSitter] = useState<Sitter | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }

      const { data: bookings } = await supabase
        .from("bookings")
        .select("sitter_id, service_type, created_at, status")
        .eq("owner_id", uid)
        .order("created_at", { ascending: false });

      const realBookings = (bookings ?? []).filter(
        (b) => b.status !== "cancelled" && b.status !== "declined",
      );

      if (realBookings.length === 0) {
        setLoading(false);
        return;
      }

      const latestBySitter = new Map<string, { service_type: string; created_at: string }>();
      for (const b of realBookings) {
        if (!latestBySitter.has(b.sitter_id)) {
          latestBySitter.set(b.sitter_id, { service_type: b.service_type, created_at: b.created_at });
        }
      }

      const sitterIds = [...latestBySitter.keys()];
      const { data: sittersData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, rates, services, coverage_areas, id_verification_status")
        .in("id", sitterIds)
        .eq("is_sitter", true);

      const result: PastSitter[] = (sittersData ?? [])
        .map((s) => {
          const latest = latestBySitter.get(s.id)!;
          const sitter: Sitter = {
            id: s.id,
            name: s.full_name || "Sitter",
            initial: initialFor(s.full_name || "S"),
            avatarColor: avatarColorFor(s.id),
            avatarUrl: s.avatar_url ?? null,
            verified: s.id_verification_status === "verified" ? "verified" : "new",
            distanceKm: null,
            rates: s.rates ?? {},
            bio: "",
            badges: [],
            coverageAreas: s.coverage_areas ?? [],
            services: s.services ?? [],
            comfortableWith: [],
            reviews: [],
          };
          return { sitter, lastService: latest.service_type, lastDate: latest.created_at };
        })
        .sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));

      setPastSitters(result);
      setLoading(false);
    })();
  }, []);

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
        <h1 className="font-serif text-xl font-semibold text-ink">Book a sitter again</h1>
      </div>

      <div className="px-5 pt-4">
        {pastSitters.length === 0 ? (
          <p className="rounded-2xl border-[1.5px] border-dashed border-line bg-white px-3.5 py-6 text-center text-xs text-muted">
            You haven&apos;t booked a sitter yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {pastSitters.map(({ sitter, lastService, lastDate }) => (
              <div
                key={sitter.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/parent/sitter/${sitter.id}`)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl font-serif font-semibold text-white"
                  style={{ background: sitter.avatarColor }}
                >
                  {sitter.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sitter.avatarUrl} alt={sitter.name} className="h-full w-full object-cover" />
                  ) : (
                    sitter.initial
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/parent/sitter/${sitter.id}`)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm font-bold text-ink">{sitter.name}</div>
                  <div className="text-xs text-muted">
                    Last: {lastService} · {formatDate(lastDate)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestingSitter(sitter)}
                  className="shrink-0 rounded-full bg-forest px-3.5 py-2 text-xs font-bold text-white"
                >
                  Request
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {requestingSitter && (
        <RequestSheet
          sitter={requestingSitter}
          service={requestingSitter.services[0] ?? "1x daily visit"}
          onClose={() => setRequestingSitter(null)}
        />
      )}
    </div>
  );
}
