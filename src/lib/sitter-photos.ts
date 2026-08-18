import { supabase } from "./supabase/client";

export interface SitterPhoto {
  position: number;
  photo_url: string;
}

export async function fetchSitterPhotos(sitterId: string): Promise<SitterPhoto[]> {
  const { data } = await supabase
    .from("sitter_photos")
    .select("position, photo_url")
    .eq("sitter_id", sitterId)
    .order("position", { ascending: true });
  return data ?? [];
}
