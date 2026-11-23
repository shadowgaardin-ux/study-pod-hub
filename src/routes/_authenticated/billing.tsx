import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { confirmPayment, startCheckout } from "@/lib/payments.functions";
import { CalendarRange, Check, CreditCard, Crown, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Billing — Study Notes" },
      { name: "description", content: "Manage your Study Notes plan and upgrade for more pods." },
      { property: "og:title", content: "Billing — Study Notes" },
      { property: "og:description", content: "Manage your Study Notes plan and upgrade for more pods." },
    ],
  }),
  validateSearch: z.object({
    reference: z.string().optional(),
    trxref: z.string().optional(),
    signup_plan: z.enum(["Pro", "Max"]).optional(),
  }),
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
  const autoStarted = useRef(false);

  const reference = search.reference ?? search.trxref;
  const signupPlan = search.signup_plan;

  useEffect(() => {
    if (!reference || handled.current) return;
    handled.current = true;
    setConfirming(true);
    confirm({ data: { reference } })
      .then(async (res) => {
        if (res.ok) {
          toast.success(`Payment confirmed — you're on ${res.tier}!`);
          await refreshProfile();
          // Paid-plan signup: payment verified, continue to the dashboard.
          if (signupPlan) {
            void navigate({ to: "/dashboard", replace: true });
            return;
          }
        } else {
          toast.error("Payment was not completed.");
        }
        void navigate({ to: "/billing", search: {}, replace: true });
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not confirm payment");
        void navigate({ to: "/billing", search: {}, replace: true });
      })
      .finally(() => setConfirming(false));
  }, [reference, signupPlan, confirm, refreshProfile, navigate]);

  // Paid-plan signup lands here: start checkout for the chosen plan once.
  useEffect(() => {
    if (!signupPlan || !profile || reference || autoStarted.current) return;
    if (profile.tier === signupPlan) return; // already active (e.g. webhook beat us)
    autoStarted.current = true;
    void handleUpgrade(signupPlan === "Max" ? "max_monthly" : "pro_monthly");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signupPlan, profile, reference]);

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
    <div className="space-y-8">
      <PageHeader
        icon={CreditCard}
        eyebrow="Billing & Plans"
        title="Choose how you study"
        description="Upgrade for more recording time, more pods and richer AI study tools. Payments are processed securely by Paystack."
      />

      <section className="glow-ring rise-in-late flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card bg-gradient-surface p-5 shadow-card sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="icon-chip size-12"><Crown className="size-5" /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current plan</p>
            <p className="display text-2xl font-bold">
              <span className="text-gradient">{current.tier}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {profile?.tier_expires_at
                ? `Active until ${new Date(profile.tier_expires_at).toLocaleDateString()}`
                : current.tier === "Free" ? "Free forever — upgrade any time" : "Active"}
            </p>
          </div>
        </div>
        {confirming ? (
          <p className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            <Loader2 className="size-4 animate-spin" /> Confirming your payment…
          </p>
        ) : (
          <Badge variant="soft" className="gap-1.5 px-3 py-1"><ShieldCheck className="size-3.5" /> Verified by Paystack</Badge>
        )}
      </section>

      {signupPlan && !confirming ? (
        <p className="rounded-xl border border-brand-amber/30 bg-brand-amber/10 px-4 py-3 text-sm">
          Almost there — complete payment to activate your{" "}
          <span className="font-semibold">{signupPlan}</span> plan. If you skip it, your account
          stays on Free and you can upgrade here any time.
        </p>
      ) : null}

      <div className="stagger grid gap-5 md:grid-cols-3">
        {TIER_ORDER.map((tier) => {
          const plan = TIER_PLANS[tier];
          const isCurrent = plan.tier === current.tier;
          const item = plan.tier === "Max" ? "max_monthly" : "pro_monthly";
          return (
            <Card
              key={tier}
              className={`lift flex flex-col ${plan.recommended ? "glow-ring border-transparent shadow-glow md:-translate-y-1" : ""} ${isCurrent ? "ring-1 ring-primary/40" : ""}`}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="display text-xl">{plan.tier}</CardTitle>
                  {isCurrent ? <Badge variant="sky">Your plan</Badge> : plan.recommended ? <Badge><Sparkles className="mr-1 size-3" />Recommended</Badge> : null}
                </div>
                <CardDescription>{plan.tagline}</CardDescription>
                <p className="display pt-1 text-4xl font-bold">
                  {plan.priceLabel}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/month</span>
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2.5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Check className="size-3" /></span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  size="lg"
                  variant={isCurrent ? "outline" : plan.recommended ? "default" : plan.tier === "Free" ? "secondary" : "outline"}
                  disabled={isCurrent || plan.tier === "Free" || pending !== null}
                  onClick={() => void handleUpgrade(item)}
                >
                  {pending === item ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isCurrent ? "Current plan" : plan.tier === "Free" ? "Free forever" : current.tier !== "Free" ? `Switch to ${plan.tier}` : `Upgrade to ${plan.tier}`}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="icon-chip size-9 text-brand-amber"><CalendarRange className="size-4" /></span>
          <div>
            <h2 className="display text-xl font-semibold">Semester Passes</h2>
            <p className="text-sm text-muted-foreground">Pay once for 3 months and save.</p>
          </div>
        </div>
        <div className="stagger grid gap-5 md:grid-cols-2">
          {[SEMESTER_PASS, MAX_SEMESTER_PASS].map((pass) => {
            const item = pass.tier === "Max" ? "max_semester" : "pro_semester";
            return (
              <Card key={pass.name} className="lift relative overflow-hidden">
                <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-brand-amber/15 blur-3xl" />
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="display text-xl">{pass.name}</CardTitle>
                    <Badge variant="amber">{pass.saveLabel}</Badge>
                  </div>
                  <CardDescription>
                    {pass.tier} features for {pass.months} months · {pass.perMonthLabel}
                  </CardDescription>
                  <p className="display pt-1 text-3xl font-bold">
                    {pass.priceLabel}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">once</span>
                  </p>
                </CardHeader>
                <CardFooter>
                  <Button className="w-full" size="lg" disabled={pending !== null} onClick={() => void handleUpgrade(item)}>
                    {pending === item ? <Loader2 className="size-4 animate-spin" /> : null}
                    Get {pass.name}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
