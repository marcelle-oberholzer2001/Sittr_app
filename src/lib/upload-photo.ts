import { supabase } from "./supabase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function uploadPhoto(file: File, path: string): Promise<{ url: string | null; error: string | null }> {
  if (!file.type.startsWith("image/")) {
    return { url: null, error: "Please choose an image file." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { url: null, error: "That image is too large — please choose one under 5MB." };
  }

  const { error: uploadError } = await supabase.storage.from("photos").upload(path, file, { upsert: true });

  if (uploadError) return { url: null, error: uploadError.message };

  const { data } = supabase.storage.from("photos").getPublicUrl(path);
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
}
