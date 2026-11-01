export const ORG_ID = "11111111-1111-4111-8111-111111111111";
export const BRANCH_ID = "22222222-2222-4222-8222-222222222222";

export const AUDIO_STATUSES = [
  "RECORDED",
  "PENDING_TRANSCRIPTION",
  "TRANSCRIBING",
  "READY",
  "FAILED",
] as const;

export type AudioProcessingStatus = (typeof AUDIO_STATUSES)[number];

export const SPECIES = ["Dog", "Cat", "Bird", "Rabbit", "Other"] as const;
export const SEXES = ["Male", "Female", "Unknown"] as const;
export const ALTERED = ["Yes", "No", "Unknown"] as const;

export const PRODUCT_CATEGORIES = [
  { id: "DOG_FOOD", label: "Dog Food", group: "FEED" },
  { id: "CAT_FOOD", label: "Cat Food", group: "FEED" },
  { id: "SUPPLEMENTS", label: "Supplements", group: "FEED" },
  { id: "LEADS", label: "Leads", group: "ACCESSORIES" },
  { id: "COLLARS", label: "Collars", group: "ACCESSORIES" },
  { id: "BOWLS", label: "Bowls", group: "ACCESSORIES" },
  { id: "TOYS", label: "Toys", group: "ACCESSORIES" },
  { id: "GROOMING", label: "Grooming", group: "ACCESSORIES" },
  { id: "OTHER", label: "Other", group: "ACCESSORIES" },
] as const;

export function categoryLabel(id: string) {
  return PRODUCT_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function productGroup(category: string) {
  return PRODUCT_CATEGORIES.find((c) => c.id === category)?.group ?? "ACCESSORIES";
}
