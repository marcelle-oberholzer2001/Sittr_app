"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface ConversationPreview {
  bookingId: string;
  otherName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export default function MessagesInboxPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }

      const { data: messages } = await supabase
        .from("messages")
        .select("booking_id, sender_id, recipient_id, text, created_at, read")
        .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
        .order("created_at", { ascending: false });

      if (!messages || messages.length === 0) {
        setLoading(false);
        return;
      }

      const byBooking = new Map<string, typeof messages>();
      for (const m of messages) {
        const list = byBooking.get(m.booking_id) ?? [];
        list.push(m);
        byBooking.set(m.booking_id, list);
      }

      const bookingIds = [...byBooking.keys()];
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, owner_id, sitter_id")
        .in("id", bookingIds);
      const bookingsById = new Map((bookings ?? []).map((b) => [b.id, b]));

      const otherIds = [
        ...new Set(
          bookingIds
            .map((id) => {
              const b = bookingsById.get(id);
              if (!b) return null;
              return b.owner_id === uid ? b.sitter_id : b.owner_id;
            })
            .filter((x): x is string => x !== null),
        ),
      ];

      const { data: others } =
        otherIds.length > 0
          ? await supabase.from("profiles").select("id, full_name").in("id", otherIds)
          : { data: [] as { id: string; full_name: string | null }[] };
      const othersById = new Map((others ?? []).map((o) => [o.id, o]));

      const list: ConversationPreview[] = bookingIds
        .map((bookingId) => {
          const msgs = byBooking.get(bookingId) ?? [];
          const b = bookingsById.get(bookingId);
          const otherId = b ? (b.owner_id === uid ? b.sitter_id : b.owner_id) : null;
          return {
            bookingId,
            otherName: (otherId && othersById.get(otherId)?.full_name) || "Sittr user",
            lastMessage: msgs[0]?.text ?? "",
            lastMessageAt: msgs[0]?.created_at ?? "",
            unreadCount: msgs.filter((m) => m.recipient_id === uid && !m.read).length,
          };
        })
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

      setConversations(list);
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
        <h1 className="font-serif text-xl font-semibold text-ink">Messages</h1>
      </div>

      <div className="px-5 pt-4">
        {conversations.length === 0 ? (
          <p className="rounded-2xl border-[1.5px] border-dashed border-line bg-white px-3.5 py-6 text-center text-xs text-muted">
            No conversations yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {conversations.map((c) => (
              <button
                key={c.bookingId}
                type="button"
                onClick={() => router.push(`/chat/${c.bookingId}`)}
                className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terracotta font-serif font-semibold text-white">
                  {c.otherName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-ink">{c.otherName}</span>
                    <span className="shrink-0 text-[0.65rem] text-muted">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-xs text-muted">{c.lastMessage}</p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-terracotta px-1.5 text-[0.65rem] font-extrabold text-white">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
