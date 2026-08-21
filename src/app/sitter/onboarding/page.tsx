"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SPECIES, DOG_SIZES, type SpeciesKey } from "@/lib/species";
import { SUBURB_SUGGESTIONS } from "@/lib/suburbs";
import { SERVICES, DEFAULT_RATES, type ServiceKey } from "@/lib/pet-services";
import { supabase } from "@/lib/supabase/client";
import { isValidSaIdNumber, submitIdNumber } from "@/lib/submit-id-number";
import { uploadPhoto } from "@/lib/upload-photo";
import { fetchSitterPhotos, type SitterPhoto } from "@/lib/sitter-photos";
import { LANGUAGES, emptyReference, type SitterReference } from "@/lib/languages";

type Sex = "Male" | "Female";

function isAdult(dob: string): boolean {
  if (!dob) return false;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age >= 18;
}

const WORK_SCHEDULES = [
  "Full-time, 9–5 (office)",
  "Full-time, remote / work from home",
  "Part-time / flexible hours",
  "Student",
  "Shift work / irregular hours",
  "Not currently working",
  "Retired",
] as const;

const SKILLS = ["🩹 First Aid", "🐶 Puppy experience", "🐱 Cat specialist", "💊 Medication experienced"];

interface PrefCard {
  key: string;
  icon: string;
  title: string;
  why: string;
  options: string[];
  defaultOn: string[];
  serviceKeys: ServiceKey[];
}

const DOG_SIZE_OPTIONS = DOG_SIZES.map((size) => `${size} dogs`);

function nonDogOptions(keys: SpeciesKey[]) {
  return SPECIES.filter((s) => keys.includes(s.key)).map((s) => s.pluralLabel);
}

// Boarding/daycare happen in the sitter's own home (space-limited); overnight/visits
// happen at the owner's home, so they can cover species a sitter couldn't house themselves.
const AT_HOME_SPECIES: SpeciesKey[] = ["cat", "bird", "snake", "reptile", "small-mammal"];
const AT_OWNERS_HOME_SPECIES: SpeciesKey[] = [...AT_HOME_SPECIES, "fish", "horse"];

const PREF_CARDS: PrefCard[] = [
  {
    key: "boarding",
    icon: "🏠",
    title: "Boarding at my home",
    why: "Limited by your space",
    options: [...DOG_SIZE_OPTIONS, ...nonDogOptions(["cat"])],
    defaultOn: ["Small dogs", "Medium dogs", "Cats"],
    serviceKeys: ["boarding"],
  },
  {
    key: "daycare",
    icon: "☀️",
    title: "Doggy daycare",
    why: "Limited by your space",
    options: [...DOG_SIZE_OPTIONS, ...nonDogOptions(["cat"])],
    defaultOn: ["Small dogs", "Medium dogs"],
    serviceKeys: ["daycare"],
  },
  {
    key: "ownersHome",
    icon: "🌙",
    title: "Overnight, daytime sits & visits",
    why: "At the owner's home",
    options: [...DOG_SIZE_OPTIONS, ...nonDogOptions(AT_OWNERS_HOME_SPECIES)],
    defaultOn: ["Small dogs", "Medium dogs", "Large dogs", "Cats"],
    serviceKeys: ["overnight", "daysit", "visit1", "visit2"],
  },
  {
    key: "walking",
    icon: "🐕",
    title: "Dog walking",
    why: "Dogs only",
    options: DOG_SIZE_OPTIONS,
    defaultOn: ["Small dogs", "Medium dogs", "Large dogs"],
    serviceKeys: ["walking30", "walking60"],
  },
];

const STEP_LABELS: Record<number, string> = {
  1: "Coverage areas",
  2: "Personal details",
  3: "Work schedule",
  4: "Transport & emergency",
  5: "Verification",
  6: "Experience & services",
  7: "Home screening",
  8: "Pet preferences",
  9: "Bank details",
};

function ToggleRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 rounded-xl border-[1.5px] py-3 text-center text-sm font-bold ${
            value === opt ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function UploadBox({
  icon,
  title,
  desc,
  done,
  optional,
}: {
  icon: string;
  title: string;
  desc: string;
  done?: boolean;
  optional?: boolean;
}) {
  return (
    <div
      className={`mb-3 flex items-center gap-3 rounded-2xl border-[1.5px] p-4 ${
        done
          ? "border-forest bg-white"
          : optional
            ? "border-dashed border-gold bg-[#FFFBEF]"
            : "border-dashed border-line bg-white"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <h4 className="mb-0.5 text-sm font-bold text-ink">{title}</h4>
        <p className="text-xs text-muted">{desc}</p>
      </div>
      {done && <span className="text-sm font-extrabold text-forest">✓</span>}
    </div>
  );
}

export default function SitterOnboardingPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(1);
  const [coverageAreas, setCoverageAreas] = useState<string[]>([]);
  const [suburbQuery, setSuburbQuery] = useState("");
  const [legalName, setLegalName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<Sex>("Male");
  const [workSchedule, setWorkSchedule] = useState<(typeof WORK_SCHEDULES)[number]>(WORK_SCHEDULES[0]);
  const [hasLicense, setHasLicense] = useState<"Yes" | "No">("Yes");
  const [backupDriverContact, setBackupDriverContact] = useState("");
  const [experienceYears, setExperienceYears] = useState(3);
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [skills, setSkills] = useState<string[]>([SKILLS[0]]);
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [references, setReferences] = useState<SitterReference[]>([emptyReference()]);
  const [householdPets, setHouseholdPets] = useState("");
  const [householdPeople, setHouseholdPeople] = useState("");
  const [fencedYard, setFencedYard] = useState<"Yes" | "No">("Yes");
  const [smokesIndoors, setSmokesIndoors] = useState<"Yes" | "No">("No");
  const [petPrefs, setPetPrefs] = useState<Record<string, string[]>>(
    Object.fromEntries(PREF_CARDS.map((c) => [c.key, c.defaultOn])),
  );
  const [emergencyContact, setEmergencyContact] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [photos, setPhotos] = useState<SitterPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPosition, setRemovingPosition] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const screeningActive = rates.boarding.enabled || rates.daycare.enabled;
  const visiblePrefCards = PREF_CARDS.filter((card) =>
    card.serviceKeys.some((key) => rates[key].enabled),
  );
  const steps = screeningActive ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 8, 9];
  const stepIndex = steps.indexOf(current);
  const isLast = stepIndex === steps.length - 1;

  function go(dir: number) {
    const idx = Math.min(steps.length - 1, Math.max(0, stepIndex + dir));
    setCurrent(steps[idx]);
  }

  function addCoverageArea(area: string) {
    setCoverageAreas((prev) => (prev.includes(area) ? prev : [...prev, area]));
    setSuburbQuery("");
  }

  function removeCoverageArea(area: string) {
    setCoverageAreas((prev) => prev.filter((a) => a !== area));
  }

  function toggleRate(key: ServiceKey) {
    setRates((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  }

  function setRateValue(key: ServiceKey, value: string) {
    setRates((prev) => ({ ...prev, [key]: { ...prev[key], rate: value } }));
  }

  function toggleSkill(skill: string) {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }

  function toggleLanguage(language: string) {
    setLanguages((prev) =>
      prev.includes(language) ? prev.filter((l) => l !== language) : [...prev, language],
    );
  }

  function updateReference(index: number, patch: Partial<SitterReference>) {
    setReferences((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addReference() {
    setReferences((prev) => (prev.length >= 3 ? prev : [...prev, emptyReference()]));
  }

  function removeReference(index: number) {
    setReferences((prev) => prev.filter((_, i) => i !== index));
  }

  function togglePref(cardKey: string, option: string) {
    setPetPrefs((prev) => {
      const list = prev[cardKey] ?? [];
      const next = list.includes(option) ? list.filter((o) => o !== option) : [...list, option];
      return { ...prev, [cardKey]: next };
    });
  }

  async function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;

    setUploadingPhoto(true);
    setPhotoError(null);

    const ext = file.name.split(".").pop() || "jpg";
    const { url, error: uploadError } = await uploadPhoto(file, `${uid}/gallery-${Date.now()}.${ext}`);

    if (uploadError) {
      setUploadingPhoto(false);
      return setPhotoError(uploadError);
    }

    const { error: addError } = await supabase.rpc("add_sitter_photo", { p_photo_url: url });

    setUploadingPhoto(false);

    if (addError) return setPhotoError(addError.message);

    setPhotos(await fetchSitterPhotos(uid));
  }

  async function handleRemovePhoto(position: number) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;

    setRemovingPosition(position);
    setPhotoError(null);

    const { error: removeError } = await supabase.rpc("remove_sitter_photo", { p_position: position });

    setRemovingPosition(null);

    if (removeError) return setPhotoError(removeError.message);

    setPhotos(await fetchSitterPhotos(uid));
  }

  async function handleFinish() {
    setFinishing(true);
    setFinishError(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setFinishing(false);
      setFinishError("You need to be logged in to finish signup.");
      return;
    }

    const services = SERVICES.filter((s) => rates[s.key].enabled).map((s) => s.label);
    const comfortableWith = [...new Set(visiblePrefCards.flatMap((card) => petPrefs[card.key] ?? []))];
    const filledReferences = references.filter((r) => r.name.trim());

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_sitter: true,
        coverage_areas: coverageAreas,
        services,
        rates,
        comfortable_with: comfortableWith,
        emergency_contact: emergencyContact,
        has_drivers_license: hasLicense === "Yes",
        backup_driver_contact: hasLicense === "No" ? backupDriverContact.trim() || null : null,
        legal_name: legalName.trim(),
        date_of_birth: dateOfBirth,
        sex,
        experience_years: experienceYears,
        skills,
        languages_spoken: languages,
        sitter_references: filledReferences.length > 0 ? filledReferences : null,
        household_pets: householdPets.trim() || null,
        household_people: householdPeople.trim() || null,
        fenced_yard: fencedYard === "Yes",
        smokes_indoors: smokesIndoors === "Yes",
      })
      .eq("id", uid);

    if (updateError) {
      setFinishing(false);
      setFinishError(updateError.message);
      return;
    }

    const { error: idError } = await submitIdNumber(idNumber);

    setFinishing(false);

    if (idError) {
      setFinishError(idError);
      return;
    }

    router.push("/sitter/welcome");
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="px-5 pt-4">
        <div className="mb-3.5 flex gap-1.5">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((s) => {
            const isSkipped = s === 7 && !screeningActive;
            const idx = steps.indexOf(s);
            const done = !isSkipped && idx >= 0 && idx < stepIndex;
            const isCurrent = s === current;
            return (
              <div
                key={s}
                className={`h-1 flex-1 rounded-[3px] ${
                  isCurrent
                    ? "bg-terracotta"
                    : isSkipped
                      ? "bg-line opacity-50"
                      : done
                        ? "bg-forest"
                        : "bg-line"
                }`}
              />
            );
          })}
        </div>
        <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
          Step {stepIndex + 1} of {steps.length} · {STEP_LABELS[current]}
        </div>
      </div>

      <div className="flex-1 px-5 pt-3 pb-4">
        {current === 1 && (
          <div>
            <h2 className="mb-1.5 font-serif text-2xl font-semibold text-ink">Which areas can you sit in?</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Search and add every suburb you&apos;re happy to travel to. No travel fees either way, so
              only add ones you&apos;d genuinely go to for free.
            </p>

            <div className="relative mb-3">
              <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink">
                🔍
                <input
                  type="text"
                  value={suburbQuery}
                  onChange={(e) => setSuburbQuery(e.target.value)}
                  placeholder="Search a suburb"
                  className="w-full text-sm text-ink outline-none placeholder:text-muted"
                />
              </div>
              {suburbQuery.length > 0 && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border-[1.5px] border-line bg-white shadow-lg">
                  {SUBURB_SUGGESTIONS.filter(
                    (s) =>
                      s.toLowerCase().includes(suburbQuery.toLowerCase()) &&
                      !coverageAreas.includes(s),
                  ).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addCoverageArea(s)}
                      className="block w-full border-b border-line px-3.5 py-2.5 text-left text-xs text-ink last:border-b-0 hover:bg-[#F1EEE6]"
                    >
                      📍 {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="mb-1.5 block text-xs font-bold text-ink">Your coverage areas</label>
            <div className="mb-3 flex flex-wrap gap-2">
              {coverageAreas.length === 0 && (
                <p className="text-xs text-muted">No areas added yet — search above to add one.</p>
              )}
              {coverageAreas.map((area) => (
                <span
                  key={area}
                  className="flex items-center gap-1.5 rounded-full border-[1.5px] border-forest bg-forest px-3.5 py-2 text-xs font-bold text-white"
                >
                  {area}
                  <button
                    type="button"
                    onClick={() => removeCoverageArea(area)}
                    aria-label={`Remove ${area}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <p className="rounded-xl bg-[#E4EEE9] px-3.5 py-3 text-xs leading-relaxed text-forest">
              💡 Owners searching in any of these suburbs will see your profile. Your exact address is
              never shown — only the suburb names you add here.
            </p>
          </div>
        )}

        {current === 2 && (
          <div>
            <h2 className="mb-1.5 font-serif text-2xl font-semibold text-ink">A few details about you</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              This information is used for verification and matching — most of it stays private.
            </p>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">Photos</label>
              <p className="mb-2 text-xs text-muted">
                First photo required, becomes your profile picture. Up to 5 total.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <div
                    key={p.position}
                    className="relative aspect-square overflow-hidden rounded-xl border border-line"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.photo_url}
                      alt={`Photo ${p.position}`}
                      className="h-full w-full object-cover"
                    />
                    {p.position === 1 && (
                      <span className="absolute top-1 left-1 rounded-md bg-forest px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                        Profile
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={removingPosition !== null}
                      onClick={() => handleRemovePhoto(p.position)}
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-xs text-white disabled:opacity-50"
                    >
                      {removingPosition === p.position ? "…" : "✕"}
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                    className="flex aspect-square items-center justify-center rounded-xl border-[1.5px] border-dashed border-line bg-white text-2xl text-muted disabled:opacity-50"
                  >
                    {uploadingPhoto ? "…" : "+"}
                  </button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAddPhoto}
              />
              {photoError && (
                <p className="mt-2 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
                  {photoError}
                </p>
              )}
              <p className="mt-2 text-xs text-muted">
                Owners are far more likely to book sitters with a clear face photo — this is public,
                unlike your address.
              </p>
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">Full legal name</label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="As it appears on your ID"
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">Date of birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
              />
              <p className="mt-1 text-xs text-muted">
                You must be 18+ to sit on Sittr — no exceptions. If a pet needs emergency vet care, a
                sitter needs to legally sign for treatment, drive, and be held accountable.
              </p>
              {dateOfBirth && !isAdult(dateOfBirth) && (
                <p className="mt-1 text-xs font-bold text-terracotta">
                  You need to be 18 or older to sit on Sittr.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink">Sex (as on your ID)</label>
              <ToggleRow options={["Male", "Female"] as const} value={sex} onChange={setSex} />
            </div>
          </div>
        )}

        {current === 3 && (
          <div>
            <h2 className="mb-1.5 font-serif text-2xl font-semibold text-ink">
              What&apos;s your day-to-day like?
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              This helps us match you to bookings that actually fit your schedule — a daycare or a 9am
              check-in only works if you&apos;re free then.
            </p>
            <label className="mb-1.5 block text-xs font-bold text-ink">Which best describes your work?</label>
            <div className="flex flex-col gap-2">
              {WORK_SCHEDULES.map((opt) => {
                const on = workSchedule === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setWorkSchedule(opt)}
                    className={`rounded-xl border-[1.5px] px-3.5 py-2.5 text-left text-xs font-bold ${
                      on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {current === 4 && (
          <div>
            <h2 className="mb-1.5 font-serif text-2xl font-semibold text-ink">Transport &amp; emergencies</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              If a pet in your care needs urgent vet attention, we need to know how you&apos;ll get them
              there.
            </p>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">
                Do you have a valid driver&apos;s license?
              </label>
              <ToggleRow options={["Yes", "No"] as const} value={hasLicense} onChange={setHasLicense} />
            </div>
            {hasLicense === "No" && (
              <div className="mb-4 rounded-xl border-[1.5px] border-terracotta bg-[#FBEAE8] p-3.5">
                <label className="mb-1.5 block text-xs font-bold text-ink">What&apos;s your backup plan?</label>
                <p className="mb-2 text-xs leading-relaxed text-muted">
                  Who can get a pet to the vet on short notice if you can&apos;t drive them yourself?
                  Owners will see this.
                </p>
                <input
                  type="text"
                  value={backupDriverContact}
                  onChange={(e) => setBackupDriverContact(e.target.value)}
                  placeholder="e.g. Neighbour, Sipho — 082 000 0000"
                  className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink">
                Emergency contact name &amp; number
              </label>
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="e.g. Mom — 082 000 0000"
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
              />
            </div>
          </div>
        )}

        {current === 5 && (
          <div>
            <h2 className="mb-1.5 font-serif text-2xl font-semibold text-ink">Verify your identity</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Your ID is required before you can accept any bookings. This is what owners are trusting
              when they book you.
            </p>
            <label className="mb-1.5 block text-xs font-bold text-ink">SA ID number</label>
            <input
              type="text"
              inputMode="numeric"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 13))}
              placeholder="13-digit ID number"
              className="mb-3 w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
            />

            <div className="my-3.5 text-center text-[0.68rem] font-extrabold tracking-wide text-muted uppercase">
              Optional, but strongly recommended
            </div>

            <UploadBox
              icon="🛡️"
              title="Criminal background check"
              desc="Via HURU at any PostNet/Jetline — often same-day, from R280"
              optional
            />
            <div className="mb-3 rounded-xl bg-[#E4EEE9] p-3.5 text-xs leading-relaxed text-forest">
              ✨ Passing this check adds a visible &quot;Background Checked&quot; badge to your profile and
              meaningfully boosts your Trust Score — owners can filter for it, and it&apos;s the single
              biggest thing you can do to stand out in search.
            </div>
            <div className="rounded-xl bg-[#E4EEE9] p-2.5 text-center text-xs font-bold text-forest">
              ✅ Your ID number is verified instantly — no waiting before you can go live.
            </div>
          </div>
        )}

        {current === 6 && (
          <div>
            <h2 className="mb-1.5 font-serif text-2xl font-semibold text-ink">Your experience</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Helps owners find the right match, and unlocks badges on your profile.
            </p>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">Years of pet care experience</label>
              <div className="flex items-center gap-2.5">
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  className="flex-1 accent-forest"
                />
                <span className="min-w-[44px] text-right text-sm font-extrabold text-ink">
                  {experienceYears} yrs
                </span>
              </div>
            </div>
            <label className="mb-1 block text-xs font-bold text-ink">Services you offer &amp; your rates</label>
            <p className="mb-2.5 text-xs leading-relaxed text-muted">
              Set your own price per service. Owners searching for a specific service (e.g.
              &quot;Overnight&quot;) will only see your rate for that service.
            </p>
            {SERVICES.map((svc) => {
              const state = rates[svc.key];
              return (
                <div key={svc.key} className="mb-2 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleRate(svc.key)}
                    className={`flex-[1.3] rounded-xl border-[1.5px] px-3 py-2.5 text-left text-xs font-bold ${
                      state.enabled
                        ? svc.clay
                          ? "border-terracotta bg-terracotta text-white"
                          : "border-forest bg-forest text-white"
                        : "border-line bg-white text-muted"
                    }`}
                  >
                    {svc.label}
                  </button>
                  <div
                    className={`flex flex-1 items-center gap-1 rounded-xl border-[1.5px] border-line bg-white px-2.5 py-2 ${
                      state.enabled ? "" : "opacity-40"
                    }`}
                  >
                    <span className="text-xs font-bold text-muted">R</span>
                    <input
                      type="text"
                      value={state.rate}
                      onChange={(e) => setRateValue(svc.key, e.target.value)}
                      placeholder="—"
                      className="w-full text-xs font-bold text-ink outline-none"
                    />
                    <span className="text-[0.68rem] font-semibold whitespace-nowrap text-muted">{svc.unit}</span>
                  </div>
                </div>
              );
            })}
            {screeningActive && (
              <p className="mt-1 mb-1 text-xs font-bold text-terracotta">
                Boarding / Daycare selected — an extra screening step has been added for your home.
              </p>
            )}
            <label className="mt-3 mb-1.5 block text-xs font-bold text-ink">Skills</label>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((skill) => {
                const on = skills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold ${
                      on ? "border-terracotta bg-terracotta text-white" : "border-line bg-white text-ink"
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 mb-1.5 block text-xs font-bold text-ink">Languages you speak</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((language) => {
                const on = languages.includes(language);
                return (
                  <button
                    key={language}
                    type="button"
                    onClick={() => toggleLanguage(language)}
                    className={`rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold ${
                      on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                    }`}
                  >
                    {language}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 mb-1.5 block text-xs font-bold text-ink">
              References <span className="font-normal text-muted">(optional)</span>
            </label>
            <p className="mb-2.5 text-xs leading-relaxed text-muted">
              People an owner could contact about your pet care — a previous client, employer, or someone
              who knows your work.
            </p>
            {references.map((ref, i) => (
              <div key={i} className="mb-2.5 rounded-2xl border-[1.5px] border-line bg-white p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Reference {i + 1}</span>
                  {references.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeReference(i)}
                      className="text-xs font-bold text-terracotta"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={ref.name}
                  onChange={(e) => updateReference(i, { name: e.target.value })}
                  placeholder="Name"
                  className="mb-2 w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink"
                />
                <input
                  type="text"
                  value={ref.relationship}
                  onChange={(e) => updateReference(i, { relationship: e.target.value })}
                  placeholder="Relationship — e.g. previous client, employer"
                  className="mb-2 w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink"
                />
                <input
                  type="text"
                  value={ref.contact}
                  onChange={(e) => updateReference(i, { contact: e.target.value })}
                  placeholder="Phone or email"
                  className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink"
                />
              </div>
            ))}
            {references.length < 3 && (
              <button
                type="button"
                onClick={addReference}
                className="w-full rounded-2xl border-[1.5px] border-dashed border-line bg-white py-2.5 text-xs font-bold text-forest"
              >
                + Add another reference
              </button>
            )}
          </div>
        )}

        {current === 7 && (
          <div>
            <h2 className="mb-1.5 font-serif text-2xl font-semibold text-ink">Home screening</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              This step only appears because you selected Boarding or Doggy Daycare — pets will be in your
              home, around your family and animals, so we screen for that separately.
            </p>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">Other pets living in your home</label>
              <input
                type="text"
                value={householdPets}
                onChange={(e) => setHouseholdPets(e.target.value)}
                placeholder="e.g. 1 cat, 1 medium dog"
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">Other people living in your home</label>
              <input
                type="text"
                value={householdPeople}
                onChange={(e) => setHouseholdPeople(e.target.value)}
                placeholder="e.g. spouse, 2 children"
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">Is your yard fully fenced?</label>
              <ToggleRow options={["Yes", "No"] as const} value={fencedYard} onChange={setFencedYard} />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">
                Anyone in your household smoke indoors?
              </label>
              <ToggleRow options={["Yes", "No"] as const} value={smokesIndoors} onChange={setSmokesIndoors} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink">
                Photos of the space pets will stay in
              </label>
              <UploadBox icon="📷" title="Upload photos" desc="Yard, sleeping area, any barriers/gates" />
            </div>
            <p className="text-xs text-muted">
              Daycare note: owners provide their pet&apos;s own food for the day — you&apos;re not expected
              to supply it.
            </p>
          </div>
        )}

        {current === 8 && (
          <div>
            <h2 className="mb-1.5 font-serif text-2xl font-semibold text-ink">Which pets, for which service?</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Set this separately per service — you might board only small dogs due to space, but be happy
              walking a large one.
            </p>
            {visiblePrefCards.length === 0 && (
              <p className="rounded-xl bg-[#F1EEE6] px-3.5 py-3 text-xs leading-relaxed text-muted">
                You haven&apos;t turned on any services yet — go back to the previous step and enable at
                least one to set pet preferences for it.
              </p>
            )}
            {visiblePrefCards.map((card) => (
              <div key={card.key} className="mb-2.5 rounded-2xl border-[1.5px] border-line bg-white p-3.5">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                  <span>
                    {card.icon} {card.title}
                  </span>
                  <span className="rounded-lg bg-[#F1EEE6] px-2 py-0.5 text-[0.62rem] font-bold text-muted">
                    {card.why}
                  </span>
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {card.options.map((opt) => {
                    const on = (petPrefs[card.key] ?? []).includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => togglePref(card.key, opt)}
                        className={`rounded-full border-[1.5px] px-2.5 py-1.5 text-xs font-bold ${
                          on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  placeholder="Breeds not comfortable with (optional)"
                  className="w-full rounded-lg border-[1.5px] border-line bg-[#fafaf8] px-2.5 py-2 text-xs text-ink"
                />
              </div>
            ))}
            <p className="mt-1 text-xs text-muted">
              Leaving a breed field blank signals you&apos;re open to all breeds for that service — sitters
              who welcome breeds others turn away (like bulldogs) tend to get booked fast.
            </p>
          </div>
        )}

        {current === 9 && (
          <div>
            <h2 className="mb-1.5 font-serif text-2xl font-semibold text-ink">
              Where should we send your earnings?
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Required before your first payout — verified against your ID for your protection.
            </p>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">Account holder name</label>
              <input
                type="text"
                placeholder="As it appears on your account"
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">Bank</label>
              <input
                type="text"
                placeholder="e.g. FNB, Capitec, Standard Bank"
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">Account number</label>
              <input
                type="text"
                placeholder="•••• •••• ••••"
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold text-ink">Branch code</label>
              <input
                type="text"
                placeholder="e.g. 250655"
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-sm text-ink"
              />
            </div>
            <p className="text-xs text-muted">
              🔒 We verify this account matches your ID before releasing any payout — protects you from
              money ever going to the wrong account.
            </p>
          </div>
        )}
      </div>

      <div className="px-5 pb-6">
        {finishError && (
          <p className="mb-3 rounded-xl bg-[#FDECE3] px-3.5 py-3 text-xs leading-relaxed text-terracotta">
            {finishError}
          </p>
        )}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => go(-1)}
            className="flex-1 rounded-2xl border-[1.5px] border-line py-3.5 text-sm font-bold text-muted"
          >
            Back
          </button>
          <button
            type="button"
            disabled={
              finishing ||
              (current === 1 && coverageAreas.length === 0) ||
              (current === 2 &&
                (photos.length === 0 || !legalName.trim() || !isAdult(dateOfBirth))) ||
              (current === 5 && !isValidSaIdNumber(idNumber))
            }
            onClick={() => (isLast ? handleFinish() : go(1))}
            className="flex-1 rounded-2xl bg-forest py-3.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {isLast ? (finishing ? "Saving…" : "Finish signup") : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
