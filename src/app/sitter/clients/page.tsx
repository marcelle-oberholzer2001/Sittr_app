"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchPetsByBooking } from "@/lib/booking-pets";

interface Client {
  petId: string;
  ownerName: string;
  petName: string;
  sits: number;
}

const CONFIRMED_STATUSES = ["accepted", "agreed", "paid", "completed"];

export default function SitterClientsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);

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
        .select("id, owner_id, status")
        .eq("sitter_id", uid)
        .in("status", CONFIRMED_STATUSES);

      if (!bookings || bookings.length === 0) {
        setLoading(false);
        return;
      }

      const ownerIds = [...new Set(bookings.map((b) => b.owner_id))];
      const bookingIds = bookings.map((b) => b.id);

      const [ownersRes, petsByBooking] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ownerIds),
        fetchPetsByBooking(bookingIds),
      ]);

      const ownersById = new Map((ownersRes.data ?? []).map((o) => [o.id, o]));

      const sitsByPet = new Map<string, number>();
      const petNameById = new Map<string, string>();
      const ownerByPet = new Map<string, string>();
      for (const b of bookings) {
        for (const pet of petsByBooking.get(b.id) ?? []) {
          sitsByPet.set(pet.id, (sitsByPet.get(pet.id) ?? 0) + 1);
          petNameById.set(pet.id, pet.name);
          ownerByPet.set(pet.id, b.owner_id);
        }
      }

      const uniquePetIds = [...sitsByPet.keys()];

      setClients(
        uniquePetIds.map((petId) => ({
          petId,
          ownerName: ownersById.get(ownerByPet.get(petId) ?? "")?.full_name || "Pet parent",
          petName: petNameById.get(petId) || "Pet",
          sits: sitsByPet.get(petId) ?? 1,
        })),
      );
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
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink">Sit Clipboards</h1>
          <p className="text-xs text-muted">One per pet parent, so nothing gets forgotten between sits</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 pt-4">
        {clients.map((c) => (
          <button
            key={c.petId}
            type="button"
            onClick={() => router.push(`/sitter/clipboard/${c.petId}`)}
            className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-left"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terracotta font-serif font-semibold text-white">
              {c.ownerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-ink">{c.ownerName}</div>
              <div className="text-xs text-muted">
                {c.petName} · {c.sits} sit{c.sits === 1 ? "" : "s"} together
              </div>
            </div>
            <span className="text-muted">›</span>
          </button>
        ))}

        {clients.length === 0 && (
          <div className="rounded-2xl border-[1.5px] border-dashed border-line bg-white p-6 text-center">
            <p className="text-xs text-muted">No confirmed sits yet — clipboards show up here once you have one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
