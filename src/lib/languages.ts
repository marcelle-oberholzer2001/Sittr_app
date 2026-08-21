export const LANGUAGES = [
  "English",
  "Afrikaans",
  "Zulu",
  "Xhosa",
  "Sotho",
  "Tswana",
  "Northern Sotho",
  "Venda",
  "Tsonga",
  "Swati",
  "Ndebele",
] as const;

export interface SitterReference {
  name: string;
  relationship: string;
  contact: string;
}

export function emptyReference(): SitterReference {
  return { name: "", relationship: "", contact: "" };
}
