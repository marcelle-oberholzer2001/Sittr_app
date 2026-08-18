export const SPECIES = [
  { key: "dog", label: "Dog", pluralLabel: "Dogs", icon: "🐶" },
  { key: "cat", label: "Cat", pluralLabel: "Cats", icon: "🐱" },
  { key: "bird", label: "Bird", pluralLabel: "Birds", icon: "🐦" },
  { key: "snake", label: "Snake", pluralLabel: "Snakes", icon: "🐍" },
  { key: "reptile", label: "Reptile", pluralLabel: "Reptiles", icon: "🦎" },
  { key: "small-mammal", label: "Small mammal", pluralLabel: "Small mammals", icon: "🐹" },
  { key: "fish", label: "Fish", pluralLabel: "Fish", icon: "🐠" },
  { key: "horse", label: "Horse", pluralLabel: "Horses", icon: "🐴" },
] as const;

export type SpeciesKey = (typeof SPECIES)[number]["key"];

export const DOG_SIZES = ["Small", "Medium", "Large"] as const;
export type DogSize = (typeof DOG_SIZES)[number];

export function comfortableLabelFor(species: SpeciesKey | string, size: string | null): string {
  if (species === "dog") return size ? `${size} dogs` : "Dogs";
  return SPECIES.find((s) => s.key === species)?.pluralLabel ?? "Pets";
}
