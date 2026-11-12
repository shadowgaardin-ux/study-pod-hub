/** All completed app sign-ins land on the signed-in home. */
export function postAuthDestination(): "/dashboard" {
  return "/dashboard";
}

const PENDING_PLAN_KEY = "study-notes:pending-plan";

/**
 * Remembers a paid plan chosen during onboarding so it survives the
 * Google OAuth round-trip and email-confirmation redirect.
 */
export function rememberPendingPlan(plan: string | undefined) {
  if (plan === "Pro" || plan === "Max") {
    sessionStorage.setItem(PENDING_PLAN_KEY, plan);
  }
}

/** Reads and clears the pending paid plan, if any. */
export function takePendingPlan(): "Pro" | "Max" | null {
  const plan = sessionStorage.getItem(PENDING_PLAN_KEY);
  sessionStorage.removeItem(PENDING_PLAN_KEY);
  return plan === "Pro" || plan === "Max" ? plan : null;
}