import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Check } from "lucide-react";
import { useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TIER_ORDER, TIER_PLANS, type Tier } from "@/lib/tiers";

export const Route = createFileRoute("/onboard/plan")({
  head: () => ({
    meta: [
      { title: "Choose your plan — Study Notes" },
      {
        name: "description",
        content:
          "Pick the Study Notes plan that fits your semester: Free, Pro or Max — then create your account.",
      },
      { property: "og:title", content: "Choose your plan — Study Notes" },
      {
        property: "og:description",
        content: "Free, Pro or Max — student pricing for collaborative study pods.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanScreen,
});

function PlanScreen() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Tier>("Pro");

  function choose(tier: Tier) {
    setSelected(tier);
    void navigate({ to: "/auth", search: { signup: true, plan: tier } });
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back home
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <div className="text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="size-5" />
          </span>
          <h1 className="display mt-4 text-3xl font-semibold sm:text-4xl">Choose your plan</h1>
          <p className="mt-3 text-muted-foreground">
            Start free and upgrade any time — your choice is saved to your profile at sign up.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TIER_ORDER.map((tier) => {
            const plan = TIER_PLANS[tier];
            const active = selected === tier;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => choose(tier)}
                onMouseEnter={() => setSelected(tier)}
                className={`surface relative flex flex-col p-7 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] ${
                  active ? "border-primary shadow-[var(--shadow-lift)]" : ""
                }`}
              >
                {plan.recommended && (
                  <Badge className="absolute -top-3 left-7">Recommended</Badge>
                )}
                <h2 className="text-xl font-semibold">{plan.tier}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                <p className="mt-6">
                  <span className="display text-4xl font-semibold">{plan.priceLabel}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-6 grow space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="mt-7 w-full"
                  variant={plan.recommended ? "default" : "outline"}
                >
                  <span>{plan.price === 0 ? "Start free" : `Choose ${plan.tier}`}</span>
                </Button>
              </button>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
