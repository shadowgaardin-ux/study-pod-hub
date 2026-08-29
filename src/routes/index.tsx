import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { session } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
            {session ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/onboard/plan">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <section className="mx-auto w-full max-w-3xl px-5 py-24 text-center">
          <Badge variant="secondary" className="mb-6 rounded-full px-3 py-1">
            Built for study groups
          </Badge>
          <h1 className="display text-4xl leading-tight font-semibold sm:text-6xl">
            Turn lectures into notes, flashcards, and quizzes — together
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Study Notes gives your course group one shared workspace: lecture notes with audio,
            flashcard decks, AI practice quizzes and live discussion.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to={session ? "/dashboard" : "/onboard/plan"}>Get Started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Sign In</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Study Notes</span>
          <nav className="flex gap-6">
            <Link to="/onboard/plan" className="hover:text-foreground">
              Pricing
            </Link>
            <Link to="/auth" className="hover:text-foreground">
              Sign In
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
