import { Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SEMESTER_PASS, TIER_PLANS } from "@/lib/tiers";

interface PaywallContextValue {
  /** Opens the soft paywall with a contextual reason. */
  showPaywall: (reason: string) => void;
}

const PaywallContext = createContext<PaywallContextValue>({ showPaywall: () => {} });

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<string | null>(null);

  const value = useMemo<PaywallContextValue>(
    () => ({ showPaywall: (next: string) => setReason(next) }),
    [],
  );

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <Dialog open={reason !== null} onOpenChange={(open) => !open && setReason(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="mb-2 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <DialogTitle className="display text-xl">You've hit your Free plan limit</DialogTitle>
            <DialogDescription>{reason}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["Pro", "Max"] as const).map((tier) => {
              const plan = TIER_PLANS[tier];
              return (
                <div
                  key={tier}
                  className={`rounded-xl border p-4 ${
                    plan.recommended ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{plan.tier}</p>
                    {plan.recommended ? <Badge>Popular</Badge> : null}
                  </div>
                  <p className="mt-1 text-2xl font-semibold">
                    {plan.priceLabel}
                    <span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </p>
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {plan.features.slice(0, 3).map((feature) => (
                      <li key={feature} className="flex gap-1.5">
                        <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
            Studying all semester? {SEMESTER_PASS.name} — {SEMESTER_PASS.priceLabel} for{" "}
            {SEMESTER_PASS.months} months of Pro ({SEMESTER_PASS.saveLabel}).
          </p>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setReason(null)}>
              Not now
            </Button>
            <Button asChild onClick={() => setReason(null)}>
              <Link to="/billing">See plans</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  return useContext(PaywallContext);
}

/** Convenience guard: returns true (and shows the paywall) when a limit is reached. */
export function useLimitGuard() {
  const { showPaywall } = usePaywall();
  return useCallback(
    (used: number, limit: number, reason: string) => {
      if (used < limit) return false;
      showPaywall(reason);
      return true;
    },
    [showPaywall],
  );
}
