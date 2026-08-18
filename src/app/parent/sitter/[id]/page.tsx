import { Suspense } from "react";
import { initialFor, avatarColorFor, type Sitter } from "@/lib/sitters";
import { supabase } from "@/lib/supabase/client";
import { fetchSitterPhotos } from "@/lib/sitter-photos";
import SitterProfileClient from "./SitterProfileClient";

export default async function SitterProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, bio, coverage_areas, services, comfortable_with, rates, avatar_url, intro_video_url")
    .eq("id", id)
    .eq("is_sitter", true)
    .single();

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <p className="text-sm text-muted">Sitter not found.</p>
      </div>
    );
  }

  const { data: reviewsData } = await supabase
    .from("reviews")
    .select("reviewer_id, rating, comment")
    .eq("reviewee_id", id)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const reviewerIds = [...new Set((reviewsData ?? []).map((r) => r.reviewer_id))];
  const { data: reviewersData } =
    reviewerIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", reviewerIds)
      : { data: [] as { id: string; full_name: string | null }[] };
  const reviewersById = new Map((reviewersData ?? []).map((r) => [r.id, r]));

  const reviews = (reviewsData ?? []).map((r) => ({
    name: reviewersById.get(r.reviewer_id)?.full_name || "A pet parent",
    rating: r.rating,
    text: r.comment || "",
  }));
  const avgRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : undefined;

  const photos = (await fetchSitterPhotos(id)).map((p) => p.photo_url);

  const sitter: Sitter = {
    id: data.id,
    name: data.full_name || "Sitter",
    initial: initialFor(data.full_name || "S"),
    avatarColor: avatarColorFor(data.id),
    avatarUrl: data.avatar_url ?? null,
    verified: "new",
    distanceKm: null,
    rates: data.rates ?? {},
    rating: avgRating,
    bio: data.bio || "",
    badges: [],
    coverageAreas: data.coverage_areas ?? [],
    services: data.services ?? [],
    comfortableWith: data.comfortable_with ?? [],
    photos,
    introVideoUrl: data.intro_video_url,
    reviews,
  };

  return (
    <Suspense>
      <SitterProfileClient sitter={sitter} />
    </Suspense>
  );
}
