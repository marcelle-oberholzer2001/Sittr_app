import type { RatesMap } from "./pet-services";

export interface Review {
  name: string;
  rating: number;
  text: string;
}

export interface Sitter {
  id: string;
  name: string;
  initial: string;
  avatarColor: string;
  avatarUrl: string | null;
  verified: "verified" | "new";
  distanceKm: number | null;
  rates: RatesMap;
  rating?: number;
  trustScore?: number;
  photos?: string[];
  introVideoUrl?: string | null;
  bio: string;
  badges: string[];
  coverageAreas: string[];
  services: string[];
  comfortableWith: string[];
  reviews: Review[];
}

const AVATAR_COLORS = ["#C77A4E", "#2C4A3E", "#8C7A5B", "#4C6B5B", "#B0562F"];

export function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || "S";
}

export function avatarColorFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
