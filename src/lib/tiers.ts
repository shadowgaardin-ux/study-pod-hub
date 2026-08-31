export type Tier = "Free" | "Pro" | "Max";

export interface TierPlan {
  tier: Tier;
  price: number;
  priceLabel: string;
  tagline: string;
  maxPods: number;
  maxNotes: number;
  maxFlashcards: number;
  features: string[];
  recommended?: boolean;
}

export const UNLIMITED = Number.POSITIVE_INFINITY;

export const TIER_PLANS: Record<Tier, TierPlan> = {
  Free: {
    tier: "Free",
    price: 0,
    priceLabel: "₦0",
    tagline: "Everything you need to try a study pod.",
    maxPods: 1,
    maxNotes: 10,
    maxFlashcards: 50,
    features: [
      "1 study pod",
      "10 lecture notes",
      "50 flashcards",
      "Pod chat & shared decks",
    ],
  },
  Pro: {
    tier: "Pro",
    price: 2500,
    priceLabel: "₦2,500",
    tagline: "For students running several courses at once.",
    maxPods: 10,
    maxNotes: 200,
    maxFlashcards: 2000,
    recommended: true,
    features: [
      "10 study pods",
      "200 lecture notes",
      "2,000 flashcards",
      "Audio uploads up to 50MB",
      "AI practice quizzes",
    ],
  },
  Max: {
    tier: "Max",
    price: 5000,
    priceLabel: "₦5,000",
    tagline: "Unlimited everything, with priority AI processing.",
    maxPods: UNLIMITED,
    maxNotes: UNLIMITED,
    maxFlashcards: UNLIMITED,
    features: [
      "Unlimited study pods",
      "Unlimited notes & flashcards",
      "Priority AI transcription",
      "Priority AI quiz generation",
      "Early access to new features",
    ],
  },
};

export const TIER_ORDER: Tier[] = ["Free", "Pro", "Max"];

export function planFor(tier: string | null | undefined): TierPlan {
  return TIER_PLANS[(tier as Tier) ?? "Free"] ?? TIER_PLANS.Free;
}

export function limitLabel(value: number): string {
  return value === UNLIMITED ? "Unlimited" : value.toLocaleString();
}

export interface SemesterPass {
  name: string;
  months: number;
  price: number;
  priceLabel: string;
  perMonthLabel: string;
  saveLabel: string;
  tier: Tier;
}

/** Discounted one-off pass for a full semester of Pro. */
export const SEMESTER_PASS: SemesterPass = {
  name: "Semester Pass",
  months: 3,
  price: 6000,
  priceLabel: "₦6,000",
  perMonthLabel: "₦2,000/mo",
  saveLabel: "save ₦1,500",
  tier: "Pro",
};

export const MAX_SEMESTER_PASS: SemesterPass = {
  name: "Max Semester Pass",
  months: 3,
  price: 12000,
  priceLabel: "₦12,000",
  perMonthLabel: "₦4,000/mo",
  saveLabel: "save ₦3,000",
  tier: "Max",
};

export type BillingCycle = "monthly" | "semester";
