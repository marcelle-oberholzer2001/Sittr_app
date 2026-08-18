import { supabase } from "./supabase/client";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export async function submitIdDocument(file: File, userId: string): Promise<{ error: string | null }> {
  if (file.size > MAX_FILE_SIZE) {
    return { error: "That file is too large — please choose one under 8MB." };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/id-document.${ext}`;

  const { error: uploadError } = await supabase.storage.from("id-documents").upload(path, file, { upsert: true });
  if (uploadError) return { error: uploadError.message };

  const { error: submitError } = await supabase.rpc("submit_id_verification", { p_document_path: path });
  if (submitError) return { error: submitError.message };

  return { error: null };
}
