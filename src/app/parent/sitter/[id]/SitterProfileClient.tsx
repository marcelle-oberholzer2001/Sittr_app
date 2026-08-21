"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Sitter } from "@/lib/sitters";
import { rateForServiceLabel } from "@/lib/pet-services";
import { RequestSheet } from "@/components/RequestSheet";
import { computeTrustScores } from "@/lib/trust-score";

function unitFor(service: string) {
  if (service.includes("visit")) return "/ visit";
  if (service.includes("Daytime") || service.includes("daycare") || service.includes("2x")) return "/ day";
  if (service.includes("Overnight") || service.includes("Boarding")) return "/ night";
  if (service.includes("walking")) return "/ walk";
  return "/ day";
}

export default function SitterProfileClient({ sitter }: { sitter: Sitter }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const service = searchParams.get("service") ?? sitter.services[0] ?? "Drop-in visits";
  const petIds = searchParams.get("petIds")?.split(",").filter(Boolean) ?? [];
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");
  const [requesting, setRequesting] = useState(searchParams.get("requesting") === "1");
  const [trustScore, setTrustScore] = useState<number | undefined>(undefined);

  useEffect(() => {
    computeTrustScores([sitter.id]).then((scores) => setTrustScore(scores.get(sitter.id)?.total));
  }, [sitter.id]);

  return (
    <div className="flex min-h-screen flex-col bg-paper pb-24">
      <div className="relative h-36 shrink-0 bg-gradient-to-br from-[#3E6152] to-[#1F3830]">
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sm"
        >
          ←
        </button>
      </div>

      <div className="relative -mt-10 px-5">
        <div
          className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-paper font-serif text-3xl font-semibold text-white"
          style={{ background: sitter.avatarColor }}
        >
          {sitter.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sitter.avatarUrl} alt={sitter.name} className="h-full w-full object-cover" />
          ) : (
            sitter.initial
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-1.5">
          <h1 className="font-serif text-xl font-semibold text-ink">{sitter.name}</h1>
          {sitter.verified === "verified" && (
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-forest text-[0.65rem] text-white">
              ✓
            </span>
          )}
        </div>
        <p className="mt-1 flex items-center text-xs text-muted">
          {sitter.rating ? (
            <span className="font-bold text-gold">★ {sitter.rating.toFixed(1)}</span>
          ) : (
            <span className="font-bold text-terracotta">✨ New</span>
          )}
          {sitter.rating ? ` (${sitter.reviews.length})` : ""}
          {sitter.distanceKm !== null && ` · ${sitter.distanceKm} km away`}
          {trustScore !== undefined && (
            <span className="ml-1.5 flex items-center gap-0.5 rounded-md bg-[#E4EEE9] px-1.5 py-0.5 text-[0.62rem] font-bold text-forest">
              🛡 Trust Score {trustScore}
            </span>
          )}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {sitter.badges.map((b) => (
            <span
              key={b}
              className="rounded-lg bg-[#F1EEE6] px-2 py-1 text-[0.66rem] font-bold text-forest"
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className="px-5 pt-5">
        <h4 className="mb-1.5 font-serif text-sm font-semibold text-ink">About {sitter.name.split(" ")[0]}</h4>
        <p className="text-sm leading-relaxed text-[#4a4438]">
          {sitter.bio || "No bio added yet."}
        </p>
      </div>

      {sitter.introVideoUrl && (
        <div className="px-5 pt-5">
          <h4 className="mb-2 font-serif text-sm font-semibold text-ink">
            Meet {sitter.name.split(" ")[0]}
          </h4>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={sitter.introVideoUrl}
            controls
            className="w-full rounded-2xl border border-line"
          />
        </div>
      )}

      {sitter.photos && sitter.photos.length > 1 && (
        <div className="px-5 pt-5">
          <h4 className="mb-2 font-serif text-sm font-semibold text-ink">Photos</h4>
          <div className="flex gap-2 overflow-x-auto">
            {sitter.photos.slice(1).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`${sitter.name}'s photo`}
                className="h-24 w-24 shrink-0 rounded-xl border border-line object-cover"
              />
            ))}
          </div>
        </div>
      )}

      <div className="px-5 pt-5">
        <h4 className="mb-2 font-serif text-sm font-semibold text-ink">Coverage areas</h4>
        <div className="flex flex-wrap gap-1.5">
          {sitter.coverageAreas.map((a) => (
            <span
              key={a}
              className="rounded-full border-[1.5px] border-forest bg-forest px-3 py-1.5 text-xs font-bold text-white"
            >
              {a}
            </span>
          ))}
        </div>
      </div>

      <div className="px-5 pt-5">
        <h4 className="mb-2 font-serif text-sm font-semibold text-ink">Services offered</h4>
        <div className="flex flex-wrap gap-1.5">
          {sitter.services.map((s) => (
            <span
              key={s}
              className="rounded-full border-[1.5px] border-forest bg-forest px-3 py-1.5 text-xs font-bold text-white"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="px-5 pt-5">
        <h4 className="mb-2 font-serif text-sm font-semibold text-ink">Comfortable with</h4>
        <div className="flex flex-wrap gap-1.5">
          {sitter.comfortableWith.map((c) => (
            <span
              key={c}
              className="rounded-full border-[1.5px] border-forest bg-forest px-3 py-1.5 text-xs font-bold text-white"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {sitter.languages && sitter.languages.length > 0 && (
        <div className="px-5 pt-5">
          <h4 className="mb-2 font-serif text-sm font-semibold text-ink">Languages spoken</h4>
          <div className="flex flex-wrap gap-1.5">
            {sitter.languages.map((l) => (
              <span
                key={l}
                className="rounded-full border-[1.5px] border-forest bg-forest px-3 py-1.5 text-xs font-bold text-white"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {sitter.references && sitter.references.length > 0 && (
        <div className="px-5 pt-5">
          <h4 className="mb-2 font-serif text-sm font-semibold text-ink">References</h4>
          <div className="flex flex-col gap-2">
            {sitter.references.map((r, i) => (
              <div key={i} className="rounded-2xl border border-line bg-white p-3.5">
                <div className="text-sm font-bold text-ink">{r.name}</div>
                <div className="text-xs text-muted">{r.relationship}</div>
                <div className="text-xs text-muted">{r.contact}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 pt-5">
        <h4 className="mb-2 font-serif text-sm font-semibold text-ink">
          Reviews {sitter.reviews.length > 0 && `(${sitter.reviews.length})`}
        </h4>
        {sitter.reviews.length === 0 ? (
          <div className="rounded-2xl border-[1.5px] border-dashed border-line bg-white p-6 text-center">
            <p className="text-xs text-muted">No reviews yet — {sitter.name.split(" ")[0]} is new to Sittr.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sitter.reviews.map((r) => (
              <div key={r.name} className="rounded-2xl border border-line bg-white p-3.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">{r.name}</span>
                  <span className="text-xs font-bold text-gold">{"★".repeat(r.rating)}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 flex w-full max-w-[430px] -translate-x-1/2 items-center gap-3.5 border-t border-line bg-paper px-5 py-4">
        <div className="flex-1">
          <div className="font-serif text-lg font-semibold text-ink">
            {rateForServiceLabel(sitter.rates, service) ?? "Rate not set yet"}
          </div>
          {rateForServiceLabel(sitter.rates, service) && (
            <div className="text-[0.65rem] text-muted">{unitFor(service)}</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setRequesting(true)}
          className="rounded-2xl bg-forest px-7 py-3.5 text-sm font-bold text-white"
        >
          Request booking
        </button>
      </div>

      {requesting && (
        <RequestSheet
          sitter={sitter}
          service={service}
          petIds={petIds}
          dateFrom={dateFrom ?? undefined}
          dateTo={dateTo ?? undefined}
          onClose={() => setRequesting(false)}
        />
      )}
    </div>
  );
}
