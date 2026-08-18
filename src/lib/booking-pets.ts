import { supabase } from "./supabase/client";

export interface BookingPet {
  id: string;
  name: string;
  species: string;
  size: string | null;
  vet_name: string | null;
  vet_phone: string | null;
}

export async function fetchPetsByBooking(bookingIds: string[]): Promise<Map<string, BookingPet[]>> {
  const map = new Map<string, BookingPet[]>();
  if (bookingIds.length === 0) return map;

  const { data } = await supabase
    .from("booking_pets")
    .select("booking_id, pets(id, name, species, size, vet_name, vet_phone)")
    .in("booking_id", bookingIds);

  for (const row of (data ?? []) as unknown as { booking_id: string; pets: BookingPet }[]) {
    const list = map.get(row.booking_id) ?? [];
    list.push(row.pets);
    map.set(row.booking_id, list);
  }
  return map;
}

export function petNames(pets: BookingPet[]): string {
  if (pets.length === 0) return "a pet";
  return pets.map((p) => p.name).join(", ");
}
