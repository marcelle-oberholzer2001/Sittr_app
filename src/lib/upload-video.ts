import { supabase } from "./supabase/client";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function uploadVideo(file: File, path: string): Promise<{ url: string | null; error: string | null }> {
  if (!file.type.startsWith("video/")) {
    return { url: null, error: "Please choose a video file." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { url: null, error: "That video is too large — please choose one under 50MB (about 30-60 seconds)." };
  }

  const { error: uploadError } = await supabase.storage.from("sitter-videos").upload(path, file, { upsert: true });

  if (uploadError) return { url: null, error: uploadError.message };

  const { data } = supabase.storage.from("sitter-videos").getPublicUrl(path);
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
}
