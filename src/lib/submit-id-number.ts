import { supabase } from "./supabase/client";

export function isValidSaIdNumber(value: string): boolean {
  return /^\d{13}$/.test(value);
}

export async function submitIdNumber(idNumber: string): Promise<{ error: string | null }> {
  if (!isValidSaIdNumber(idNumber)) {
    return { error: "ID number must be exactly 13 digits." };
  }

  const { error } = await supabase.rpc("submit_id_number", { p_id_number: idNumber });
  if (error) return { error: error.message };

  return { error: null };
}
