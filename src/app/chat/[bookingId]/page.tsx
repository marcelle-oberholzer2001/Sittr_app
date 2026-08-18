"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface Message {
  id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [otherId, setOtherId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      setUserId(uid);

      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("owner_id, sitter_id")
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        setLoading(false);
        setNotFound(true);
        return;
      }

      const otherUserId = booking.owner_id === uid ? booking.sitter_id : booking.owner_id;
      setOtherId(otherUserId);

      const { data: otherProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", otherUserId)
        .single();
      setOtherName(otherProfile?.full_name || "them");

      const { data: existingMessages } = await supabase
        .from("messages")
        .select("id, sender_id, text, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      setMessages(existingMessages ?? []);

      await supabase
        .from("messages")
        .update({ read: true })
        .eq("booking_id", bookingId)
        .eq("recipient_id", uid)
        .eq("read", false);

      setLoading(false);
    })();
  }, [bookingId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`messages-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `booking_id=eq.${bookingId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
          if (newMsg.sender_id !== userId) {
            await supabase.from("messages").update({ read: true }).eq("id", newMsg.id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!draft.trim() || !userId || !otherId) return;
    setSending(true);
    setError(null);

    const text = draft.trim();
    setDraft("");

    const { error: insertError } = await supabase.from("messages").insert({
      booking_id: bookingId,
      sender_id: userId,
      recipient_id: otherId,
      text,
    });

    setSending(false);

    if (insertError) {
      setError(insertError.message);
      setDraft(text);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <p className="text-sm text-muted">Conversation not found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-sm"
        >
          ←
        </button>
        <div className="h-9 w-9 rounded-lg bg-terracotta" />
        <div className="font-serif text-sm font-semibold text-ink">{otherName}</div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-5 py-4">
        {messages.length === 0 && (
          <p className="mx-auto mt-8 max-w-[85%] text-center text-xs text-muted">
            No messages yet — say hello to {otherName}.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
              m.sender_id === userId
                ? "self-end rounded-br-[4px] bg-forest text-white"
                : "self-start rounded-bl-[4px] border border-line bg-white text-ink"
            }`}
          >
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mx-5 mb-2 rounded-xl bg-[#FDECE3] px-3.5 py-2 text-xs text-terracotta">{error}</p>
      )}

      <div className="flex items-center gap-2 border-t border-line px-5 py-3 pb-6">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder={`Message ${otherName}…`}
          className="flex-1 rounded-full border-[1.5px] border-line bg-white px-4 py-2.5 text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="button"
          disabled={sending || !draft.trim()}
          onClick={sendMessage}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-white disabled:opacity-50"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
