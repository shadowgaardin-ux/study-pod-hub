import { Link, createFileRoute } from "@tanstack/react-router";

import logoUrl from "@/assets/study-notes-hub-logo-compact.png";
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
          <Link to="/" className="flex items-center" aria-label="Study Notes Hub home">
            <img
              src={logoUrl}
              alt="Study Notes Hub"
              className="h-9 w-auto transition-transform duration-300 hover:scale-105 dark:rounded-md dark:bg-logo-surface dark:ring-1 dark:ring-ai/30 dark:px-2 dark:py-1"
            />
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

      <main className="aurora flex flex-1 items-center">
        <section className="mx-auto w-full max-w-3xl px-5 py-24 text-center">
          <Badge variant="secondary" className="rise-in mb-6 rounded-full border border-brand-purple/30 bg-accent px-3 py-1 text-accent-foreground">
            Built for study groups
          </Badge>
          <h1 className="display text-4xl leading-tight font-semibold sm:text-6xl">
            Turn lectures into notes, flashcards, and quizzes — <span className="text-gradient">together</span>
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
          <div className="rise-in-later mt-14 grid gap-3 text-left sm:grid-cols-3">
            {[
              { title: "Record lectures", text: "Audio with automatic transcripts.", tone: "bg-brand-purple" },
              { title: "Study together", text: "Shared notes, flashcards and chat.", tone: "bg-brand-teal" },
              { title: "Practise smarter", text: "AI quizzes from your own notes.", tone: "bg-brand-amber" },
            ].map((f) => (
              <div key={f.title} className="surface lift p-5">
                <span className={`mb-3 block h-1.5 w-10 rounded-full ${f.tone}`} />
                <p className="font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
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
