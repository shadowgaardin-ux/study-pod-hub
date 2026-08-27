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
