import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { confirmPayment, startCheckout } from "@/lib/payments.functions";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { MAX_SEMESTER_PASS, SEMESTER_PASS, TIER_ORDER, TIER_PLANS, planFor } from "@/lib/tiers";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Study Notes" },
      { name: "description", content: "Manage your Study Notes plan and upgrade for more pods." },
      { property: "og:title", content: "Billing — Study Notes" },
      { property: "og:description", content: "Manage your Study Notes plan and upgrade for more pods." },
    ],
  }),
  validateSearch: z.object({ reference: z.string().optional(), trxref: z.string().optional() }),
  component: BillingPage,
});

function BillingPage() {
  const { profile, refreshProfile } = useAuth();
  const current = planFor(profile?.tier);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const checkout = useServerFn(startCheckout);
  const confirm = useServerFn(confirmPayment);
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const handled = useRef(false);

  const reference = search.reference ?? search.trxref;
  useEffect(() => {
    if (!reference || handled.current) return;
    handled.current = true;
    setConfirming(true);
    confirm({ data: { reference } })
      .then(async (res) => {
        if (res.ok) {
          toast.success(`Payment confirmed — you're on ${res.tier}!`);
          await refreshProfile();
        } else {
          toast.error("Payment was not completed.");
        }
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not confirm payment"))
      .finally(() => {
        setConfirming(false);
        void navigate({ to: "/billing", search: {}, replace: true });
      });
  }, [reference, confirm, refreshProfile, navigate]);

  async function handleUpgrade(item: "pro_monthly" | "max_monthly" | "pro_semester" | "max_semester") {
    setPending(item);
    try {
      const { url } = await checkout({ data: { item } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          You are on the <span className="font-medium text-foreground">{current.tier}</span> plan.
          {profile?.tier_expires_at
            ? ` Renews ${new Date(profile.tier_expires_at).toLocaleDateString()}.`
            : ""}
        </p>
        {confirming ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-primary">
            <Loader2 className="size-4 animate-spin" /> Confirming your payment…
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TIER_ORDER.map((tier) => {
          const plan = TIER_PLANS[tier];
          const isCurrent = plan.tier === current.tier;
          return (
            <Card key={tier} className={plan.recommended ? "border-primary" : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="display text-xl">{plan.tier}</CardTitle>
                  {plan.recommended ? <Badge>Recommended</Badge> : null}
                </div>
                <CardDescription>{plan.tagline}</CardDescription>
                <p className="pt-2 text-3xl font-semibold">
                  {plan.priceLabel}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : plan.recommended ? "default" : "secondary"}
                  disabled={isCurrent || plan.tier === "Free" || pending !== null}
                  onClick={() => void handleUpgrade(plan.tier === "Max" ? "max_monthly" : "pro_monthly")}
                >
                  {pending === (plan.tier === "Max" ? "max_monthly" : "pro_monthly") ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isCurrent ? "Current plan" : plan.tier === "Free" ? "Free forever" : current.tier !== "Free" ? `Switch to ${plan.tier}` : `Upgrade to ${plan.tier}`}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="display text-xl font-semibold">Semester Passes</h2>
        <p className="text-sm text-muted-foreground">Pay once for 3 months and save.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[SEMESTER_PASS, MAX_SEMESTER_PASS].map((pass) => (
          <Card key={pass.name} className="border-primary/40 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="display text-xl">{pass.name}</CardTitle>
                <Badge>{pass.saveLabel}</Badge>
              </div>
              <CardDescription>
                {pass.tier} features for {pass.months} months · {pass.perMonthLabel}
              </CardDescription>
              <p className="pt-2 text-3xl font-semibold">
                {pass.priceLabel}
                <span className="text-sm font-normal text-muted-foreground"> once</span>
              </p>
            </CardHeader>
            <CardFooter>
              <Button
                className="w-full"
                disabled={pending !== null}
                onClick={() => void handleUpgrade(pass.tier === "Max" ? "max_semester" : "pro_semester")}
              >
                {pending === (pass.tier === "Max" ? "max_semester" : "pro_semester") ? <Loader2 className="size-4 animate-spin" /> : null}
                Get {pass.name}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
