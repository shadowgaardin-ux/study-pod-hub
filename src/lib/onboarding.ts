/** First-time onboarding tour: steps and per-user completion memory. */

export type TourStepId = "dashboard" | "record" | "library" | "pods" | "assistant" | "finish";

export interface TourStep {
  id: TourStepId;
  title: string;
  body: string;
  /** `data-tour` targets in priority order; the first visible one is highlighted. */
  targets: string[];
}

export const TOUR_STEPS: TourStep[] = [
  { id: "dashboard", title: "Your study home", body: "Everything starts here — recordings, notes and your pods, one tap away.", targets: ["nav-dashboard", "dashboard-hero"] },
  { id: "record", title: "Record with AI", body: "Record lectures and turn them into useful study material.", targets: ["record-button"] },
  { id: "library", title: "Personal Library", body: "Keep your notes, recordings and resources organized.", targets: ["nav-library", "dashboard-library"] },
  { id: "pods", title: "Study Pods", body: "Study and collaborate with other students.", targets: ["nav-pods", "dashboard-pods"] },
  { id: "assistant", title: "AI Assistant", body: "Summarize, create bullet points, flashcards and quizzes.", targets: ["nav-assistant", "dashboard-assistant"] },
  { id: "finish", title: "You're ready to study!", body: "Replay this tour anytime from the Help button at the top of the screen.", targets: [] },
];

/** Leave empty until the tutorial video is published; the Help menu then shows it as coming soon. */
export const TUTORIAL_VIDEO_URL = "";

/** Key in the signed-in user's account metadata, so completion follows them across devices. */
export const TOUR_METADATA_KEY = "onboarding_tour_completed_at";

export function tourStorageKey(userId: string) {
  return `study-notes:tour-completed:${userId}`;
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** True once this specific user has finished or skipped the tour (on this device or any other). */
export function hasCompletedTour(
  userId: string,
  metadata: Record<string, unknown> | null | undefined,
  store: KeyValueStore | null,
): boolean {
  if (metadata && typeof metadata[TOUR_METADATA_KEY] === "string") return true;
  try {
    return Boolean(store?.getItem(tourStorageKey(userId)));
  } catch {
    return false;
  }
}

export function rememberTourOnDevice(userId: string, store: KeyValueStore | null, at = new Date().toISOString()) {
  try {
    store?.setItem(tourStorageKey(userId), at);
  } catch {
    // Storage can be unavailable (private mode); account metadata still records completion.
  }
}
