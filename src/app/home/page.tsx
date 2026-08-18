"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchPetsByBooking, petNames } from "@/lib/booking-pets";

type Role = "sitter" | "parent";
type Router = ReturnType<typeof useRouter>;

interface SitterBookingPreview {
  id: string;
  ownerName: string;
  serviceType: string;
  petName: string;
  dateFrom: string;
  dateTo: string;
}

function formatDateRange(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const fromStr = new Date(from).toLocaleDateString("en-ZA", opts);
  const toStr = new Date(to).toLocaleDateString("en-ZA", opts);
  return `${fromStr}–${toStr}`;
}

function SitterHome({ router, isVerified }: { router: Router; isVerified: boolean }) {
  const [pendingRequests, setPendingRequests] = useState<SitterBookingPreview[]>([]);
  const [needsReview, setNeedsReview] = useState<SitterBookingPreview[]>([]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;

      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, owner_id, service_type, date_from, date_to, status")
        .eq("sitter_id", uid)
        .order("created_at", { ascending: false });

      if (!bookings || bookings.length === 0) return;

      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("booking_id")
        .eq("reviewer_id", uid);
      const reviewedIds = new Set((reviewsData ?? []).map((r) => r.booking_id));

      const ownerIds = [...new Set(bookings.map((b) => b.owner_id))];
      const bookingIds = bookings.map((b) => b.id);

      const [ownersRes, petsByBooking] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ownerIds),
        fetchPetsByBooking(bookingIds),
      ]);
      const ownersById = new Map((ownersRes.data ?? []).map((o) => [o.id, o]));

      const toPreview = (b: (typeof bookings)[number]): SitterBookingPreview => ({
        id: b.id,
        ownerName: ownersById.get(b.owner_id)?.full_name || "Pet parent",
        serviceType: b.service_type,
        petName: petNames(petsByBooking.get(b.id) ?? []),
        dateFrom: b.date_from,
        dateTo: b.date_to,
      });

      setPendingRequests(bookings.filter((b) => b.status === "pending").map(toPreview));
      setNeedsReview(
        bookings.filter((b) => b.status === "completed" && !reviewedIds.has(b.id)).map(toPreview),
      );
    })();
  }, []);

  return (
    <div>
      {isVerified ? (
        <div className="mb-4 rounded-2xl bg-[#E4EEE9] p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-lg">✅</span>
            <h3 className="font-serif text-base font-semibold text-ink">You&apos;re live</h3>
          </div>
          <p className="text-xs leading-relaxed text-forest">
            Your profile is approved and visible to owners searching in your coverage areas.
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl bg-[#F3E3D6] p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-lg">⏳</span>
            <h3 className="font-serif text-base font-semibold text-ink">Profile pending verification</h3>
          </div>
          <p className="text-xs leading-relaxed text-terracotta">
            Your ID is under review — usually 1–3 days. You&apos;ll be visible to owners in your coverage
            areas as soon as you&apos;re approved.
          </p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => router.push("/sitter/coverage")}
          className="rounded-2xl border-[1.5px] border-line bg-white p-3.5 text-left"
        >
          <div className="mb-1 text-lg">📍</div>
          <div className="text-[0.7rem] font-bold text-ink">Coverage areas</div>
        </button>
        <button
          type="button"
          onClick={() => router.push("/sitter/rates")}
          className="rounded-2xl border-[1.5px] border-line bg-white p-3.5 text-left"
        >
          <div className="mb-1 text-lg">🏷️</div>
          <div className="text-[0.7rem] font-bold text-ink">My rates</div>
        </button>
        <button
          type="button"
          onClick={() => router.push("/sitter/availability")}
          className="rounded-2xl border-[1.5px] border-line bg-white p-3.5 text-left"
        >
          <div className="mb-1 text-lg">📅</div>
          <div className="text-[0.7rem] font-bold text-ink">Availability</div>
        </button>
        <button
          type="button"
          onClick={() => router.push("/sitter/payouts")}
          className="rounded-2xl border-[1.5px] border-line bg-white p-3.5 text-left"
        >
          <div className="mb-1 text-lg">💰</div>
          <div className="text-[0.7rem] font-bold text-ink">Payouts</div>
        </button>
        <button
          type="button"
          onClick={() => router.push("/sitter/sos")}
          className="rounded-2xl border-[1.5px] border-line bg-white p-3.5 text-left"
        >
          <div className="mb-1 text-lg">🆘</div>
          <div className="text-[0.7rem] font-bold text-ink">SOS alerts</div>
        </button>
      </div>

      <div className="mb-2 text-[0.72rem] font-extrabold tracking-wide text-terracotta uppercase">Requests</div>

      {pendingRequests.length === 0 && needsReview.length === 0 && (
        <p className="rounded-2xl border-[1.5px] border-dashed border-line bg-white px-3.5 py-5 text-center text-xs text-muted">
          Nothing new right now.
        </p>
      )}

      {pendingRequests.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => router.push("/sitter/requests")}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-left"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terracotta font-serif font-semibold text-white">
              {pendingRequests[0].ownerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-ink">
                {pendingRequests[0].ownerName} — {pendingRequests[0].serviceType} for {pendingRequests[0].petName}
              </div>
              <div className="text-xs text-muted">
                {formatDateRange(pendingRequests[0].dateFrom, pendingRequests[0].dateTo)}
              </div>
            </div>
            <span className="rounded-lg bg-terracotta px-2 py-1 text-[0.62rem] font-extrabold text-white">NEW</span>
          </button>
          {pendingRequests.length > 1 && (
            <p className="mt-1.5 text-xs text-muted">+{pendingRequests.length - 1} more waiting</p>
          )}
        </>
      )}

      {needsReview.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => router.push(`/sitter/review?bookingId=${needsReview[0].id}`)}
            className="mt-2.5 flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-left"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest font-serif font-semibold text-white">
              {needsReview[0].ownerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-ink">
                {needsReview[0].ownerName} — {needsReview[0].serviceType} for {needsReview[0].petName}
              </div>
              <div className="text-xs text-muted">Completed · Leave a review</div>
            </div>
            <span className="text-muted">›</span>
          </button>
          {needsReview.length > 1 && (
            <p className="mt-1.5 text-xs text-muted">+{needsReview.length - 1} more to review</p>
          )}
        </>
      )}

      <div className="mt-5 mb-2 text-[0.72rem] font-extrabold tracking-wide text-terracotta uppercase">
        Sit Clipboards
      </div>
      <button
        type="button"
        onClick={() => router.push("/sitter/clients")}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-left"
      >
        <span className="text-lg">📋</span>
        <div className="flex-1">
          <div className="text-sm font-bold text-ink">Your pet parents</div>
          <div className="text-xs text-muted">Pet care, home details & meet &amp; greet notes, per client</div>
        </div>
        <span className="text-muted">›</span>
      </button>
    </div>
  );
}

interface RequestPreview {
  id: string;
  sitterName: string;
  petName: string;
  serviceType: string;
  status: string;
}

function statusLabel(status: string) {
  if (status === "pending") return "Waiting for sitter to respond";
  if (status === "accepted") return "Accepted, awaiting your agreement";
  if (status === "agreed") return "Agreed, awaiting payment";
  if (status === "paid") return "Paid — booking confirmed";
  if (status === "declined") return "Declined";
  return status;
}

interface PetPreview {
  id: string;
  name: string;
  summary: string;
  photoUrl: string | null;
}

function ParentHome({ router }: { router: Router }) {
  const [requests, setRequests] = useState<RequestPreview[]>([]);
  const [pets, setPets] = useState<PetPreview[]>([]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;

      const { data: petsData } = await supabase
        .from("pets")
        .select("id, name, species, size, breed, photo_url")
        .eq("owner_id", uid)
        .order("created_at", { ascending: false });

      if (petsData) {
        setPets(
          petsData.map((p) => ({
            id: p.id,
            name: p.name,
            summary: [p.breed, p.size, p.species].filter(Boolean).join(" · "),
            photoUrl: p.photo_url,
          })),
        );
      }

      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, sitter_id, service_type, status")
        .eq("owner_id", uid)
        .order("created_at", { ascending: false });

      if (!bookings || bookings.length === 0) return;

      const sitterIds = [...new Set(bookings.map((b) => b.sitter_id))];
      const bookingIds = bookings.map((b) => b.id);

      const [sittersRes, petsByBooking] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", sitterIds),
        fetchPetsByBooking(bookingIds),
      ]);

      const sittersById = new Map((sittersRes.data ?? []).map((s) => [s.id, s]));

      setRequests(
        bookings.map((b) => ({
          id: b.id,
          sitterName: sittersById.get(b.sitter_id)?.full_name || "Sitter",
          petName: petNames(petsByBooking.get(b.id) ?? []),
          serviceType: b.service_type,
          status: b.status,
        })),
      );
    })();
  }, []);

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push("/parent/quick-start")}
        className="mb-4 w-full rounded-2xl bg-forest py-4 text-sm font-bold text-white"
      >
        🔍 Find a sitter
      </button>

      <div className="mb-2 flex items-center justify-between">
        <div className="text-[0.72rem] font-extrabold tracking-wide text-terracotta uppercase">My pets</div>
        <button
          type="button"
          onClick={() => router.push("/parent/pet-passport")}
          className="text-xs font-bold text-forest"
        >
          + Add pet
        </button>
      </div>
      {pets.length === 0 ? (
        <div className="mb-4 rounded-2xl border-[1.5px] border-dashed border-line bg-white p-6 text-center">
          <p className="text-xs text-muted">No pets added yet.</p>
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-2.5">
          {pets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => router.push(`/parent/pet-passport/edit?petId=${p.id}`)}
              className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-terracotta font-serif font-semibold text-white">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  "🐾"
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-ink">{p.name}</div>
                <div className="text-xs text-muted">{p.summary}</div>
              </div>
              <span className="text-muted">›</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push("/parent/home-details")}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-left"
      >
        <span className="text-lg">🏠</span>
        <div className="flex-1">
          <div className="text-sm font-bold text-ink">Home details</div>
          <div className="text-xs text-muted">WiFi, access code & notes — only unlocks for a confirmed sitter</div>
        </div>
        <span className="text-muted">›</span>
      </button>

      <div className="mb-2 text-[0.72rem] font-extrabold tracking-wide text-terracotta uppercase">
        Sent requests
      </div>
      {requests.length === 0 ? (
        <p className="rounded-2xl border-[1.5px] border-dashed border-line bg-white px-3.5 py-5 text-center text-xs text-muted">
          No requests sent yet.
        </p>
      ) : (
        requests.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => router.push("/parent/agreement")}
            className="mb-2.5 flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-left"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest font-serif font-semibold text-white">
              {r.sitterName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-ink">
                {r.sitterName} — {r.serviceType} for {r.petName}
              </div>
              <div className="text-xs text-muted">{statusLabel(r.status)}</div>
            </div>
            <span className="text-muted">›</span>
          </button>
        ))
      )}
    </div>
  );
}

const TABS = [
  { icon: "🏠", label: "Home", active: true },
  { icon: "💬", label: "Messages" },
  { icon: "🔍", label: "Search" },
  { icon: "⋯", label: "More" },
];

interface Notification {
  id: string;
  icon: string;
  text: string;
  created_at: string;
  read: boolean;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("sitter");
  const [isVerified, setIsVerified] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const hasUnread = notifications.some((n) => !n.read);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;

      const { data } = await supabase
        .from("profiles")
        .select("id_verification_status, is_sitter, is_owner")
        .eq("id", uid)
        .single();

      setIsVerified(data?.id_verification_status === "verified");

      const storedRole = localStorage.getItem("sittr_home_role");
      if (storedRole === "sitter" || storedRole === "parent") {
        setRole(storedRole);
      } else if (data?.is_owner && !data?.is_sitter) {
        setRole("parent");
      } else if (data?.is_sitter && !data?.is_owner) {
        setRole("sitter");
      }

      const { data: notifData } = await supabase
        .from("notifications")
        .select("id, icon, text, created_at, read")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20);

      if (notifData) setNotifications(notifData);
    })();
  }, []);

  async function handleBellClick() {
    setShowNotifications((v) => !v);

    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="relative flex items-center justify-between px-5 pt-4 pb-2">
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink">Welcome back 👋</h1>
          <p className="text-xs text-muted">Here&apos;s what&apos;s happening</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleBellClick}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-sm"
          >
            🔔
            {hasUnread && (
              <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-terracotta" />
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push(role === "sitter" ? "/sitter/profile" : "/parent/profile")}
            aria-label="Open your profile"
            className="h-9 w-9 rounded-full bg-terracotta"
          />
        </div>

        {showNotifications && (
          <div className="absolute top-16 right-5 z-40 w-72 rounded-2xl border border-line bg-white p-2 shadow-lg">
            {notifications.length === 0 && (
              <p className="p-3 text-center text-xs text-muted">No notifications yet.</p>
            )}
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-2.5 rounded-xl p-2.5">
                <span className="text-base">{n.icon}</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-ink">{n.text}</p>
                  <p className="text-[0.65rem] text-muted">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mx-5 mb-4 flex rounded-2xl border-[1.5px] border-line bg-white p-1">
        <button
          type="button"
          onClick={() => {
            setRole("sitter");
            localStorage.setItem("sittr_home_role", "sitter");
          }}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold ${
            role === "sitter" ? "bg-forest text-white" : "text-muted"
          }`}
        >
          🐾 Sitting
        </button>
        <button
          type="button"
          onClick={() => {
            setRole("parent");
            localStorage.setItem("sittr_home_role", "parent");
          }}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold ${
            role === "parent" ? "bg-forest text-white" : "text-muted"
          }`}
        >
          🔍 Pet parent
        </button>
      </div>

      <div className="flex-1 px-5 pb-6">
        {role === "sitter" ? (
          <SitterHome router={router} isVerified={isVerified} />
        ) : (
          <ParentHome router={router} />
        )}
      </div>

      <div className="flex border-t border-line bg-white px-2 pt-2.5 pb-6">
        {TABS.map((tab) =>
          tab.label === "Messages" ? (
            <button
              key={tab.label}
              type="button"
              onClick={() => router.push("/chat")}
              className="flex flex-1 flex-col items-center gap-0.5 text-[0.62rem] font-bold text-muted"
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ) : (
            <div
              key={tab.label}
              className={`flex flex-1 flex-col items-center gap-0.5 text-[0.62rem] font-bold ${
                tab.active ? "text-forest" : "text-muted"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
