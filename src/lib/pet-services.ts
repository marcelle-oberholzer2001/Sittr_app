export const SERVICE_NAMES = [
  "1x daily visit",
  "2x daily visits",
  "Daytime pet sit",
  "Overnight / sleepover",
  "Dog walking (30 min)",
  "Dog walking (60 min)",
  "Boarding at my home",
  "Doggy daycare",
] as const;

export type ServiceKey =
  | "visit1"
  | "visit2"
  | "daysit"
  | "overnight"
  | "walking30"
  | "walking60"
  | "boarding"
  | "daycare";

export interface ServiceDef {
  key: ServiceKey;
  label: string;
  unit: string;
  clay?: boolean;
}

export const SERVICES: ServiceDef[] = [
  { key: "visit1", label: "1x daily visit", unit: "/ visit" },
  { key: "visit2", label: "2x daily visits", unit: "/ day" },
  { key: "daysit", label: "Daytime pet sit", unit: "/ day" },
  { key: "overnight", label: "Overnight / sleepover", unit: "/ night" },
  { key: "walking30", label: "Dog walking (30 min)", unit: "/ walk" },
  { key: "walking60", label: "Dog walking (60 min)", unit: "/ walk" },
  { key: "boarding", label: "Boarding at my home", unit: "/ night", clay: true },
  { key: "daycare", label: "Doggy daycare", unit: "/ day", clay: true },
];

export const DEFAULT_RATES: Record<ServiceKey, { enabled: boolean; rate: string }> = {
  visit1: { enabled: true, rate: "80" },
  visit2: { enabled: true, rate: "140" },
  daysit: { enabled: false, rate: "" },
  overnight: { enabled: true, rate: "300" },
  walking30: { enabled: false, rate: "" },
  walking60: { enabled: false, rate: "" },
  boarding: { enabled: true, rate: "280" },
  daycare: { enabled: true, rate: "150" },
};

export type RatesMap = Partial<Record<ServiceKey, { enabled: boolean; rate: string }>>;

export function rateForServiceLabel(rates: RatesMap, label: string): string | null {
  const svc = SERVICES.find((s) => s.label === label);
  if (!svc) return null;
  const entry = rates[svc.key];
  if (!entry || !entry.enabled || !entry.rate) return null;
  return `R${entry.rate}`;
}
