import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, Check, Layers, Mic2, MessagesSquare, Sparkles, Users } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { TIER_ORDER, TIER_PLANS } from "@/lib/tiers";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Study Notes — Turn lectures into notes, flashcards and quizzes" },
      {
        name: "description",
        content:
          "Study Notes is a collaborative workspace where course mates share lecture notes, flashcard decks, AI practice quizzes and live pod chat.",
      },
      { property: "og:title", content: "Study Notes — Collaborative study pods" },
      {
        property: "og:description",
        content: "Turn lectures into notes, flashcards and quizzes — together.",
      },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    icon: Users,
    title: "Study Pods",
    body: "Create a pod per course, share a 6-character invite code, and keep every classmate on the same page.",
  },
  {
    icon: Mic2,
    title: "AI Transcription",
    body: "Upload lecture audio and keep the transcript and summary attached to the note for the whole pod.",
  },
  {
    icon: Layers,
    title: "Flashcard Decks",
    body: "Build shared decks card by card and revise with a clean flip-card interface before exams.",
  },
  {
    icon: Sparkles,
    title: "Practice Quizzes",
    body: "Generate multiple-choice practice sets from your pod's notes and track your score run by run.",
  },
];

function LandingPage() {
  const { session } = useAuth();
  const ctaTo = session ? "/dashboard" : "/auth";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="size-4" />
            </span>
            <span className="display text-lg font-semibold">Study Notes</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link to={ctaTo}>{session ? "Open dashboard" : "Get Started"}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-20 pb-16 text-center">
          <Badge variant="secondary" className="mb-6 rounded-full px-3 py-1">
            Built for study groups
          </Badge>
          <h1 className="display mx-auto max-w-3xl text-4xl leading-tight font-semibold sm:text-6xl">
            Turn lectures into notes, flashcards, and quizzes — together
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Study Notes gives your course group one shared workspace: lecture notes with audio,
            flashcard decks, AI practice quizzes and live discussion.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to={ctaTo}>Get Started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#pricing">See pricing</a>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="surface p-6">
                <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="border-y border-border bg-secondary/40 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="text-center">
              <h2 className="display text-3xl font-semibold sm:text-4xl">Simple student pricing</h2>
              <p className="mt-3 text-muted-foreground">
                Start free. Upgrade when your pods grow.
              </p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {TIER_ORDER.map((tier) => {
                const plan = TIER_PLANS[tier];
                return (
                  <div
                    key={tier}
                    className={`surface relative flex flex-col p-7 ${
                      plan.recommended ? "border-primary shadow-[var(--shadow-lift)] lg:-mt-3" : ""
                    }`}
                  >
                    {plan.recommended && (
                      <Badge className="absolute -top-3 left-7">Recommended</Badge>
                    )}
                    <h3 className="text-xl font-semibold">{plan.tier}</h3>
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
                      className="mt-7"
                      variant={plan.recommended ? "default" : "outline"}
                    >
                      <Link to={session ? "/billing" : "/auth"}>
                        {plan.price === 0 ? "Start free" : `Choose ${plan.tier}`}
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <MessagesSquare className="mx-auto size-8 text-primary" />
          <h2 className="display mt-4 text-3xl font-semibold">Studying is better in a pod</h2>
          <p className="mt-3 text-muted-foreground">
            Invite your class, split the note-taking, and revise from one shared library.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link to={ctaTo}>Create your first pod</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Study Notes</span>
          <nav className="flex gap-6">
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
            <Link to="/auth" className="hover:text-foreground">
              Log in
            </Link>
            <Link to="/auth" className="hover:text-foreground">
              Sign up
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
