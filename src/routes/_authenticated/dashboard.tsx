import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Compass,
  FileAudio,
  FileText,
  Library,
  Mic,
  Plus,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";

import { AiAssistant } from "@/components/ai/ai-assistant";
import { AudioHub } from "@/components/dashboard/audio-hub";
import { PersonalLibrary } from "@/components/dashboard/personal-library";
import { DiscoverTab } from "@/components/pods/discover-tab";
import { PodCard } from "@/components/pods/pod-card";
import { CreatePodDialog, JoinPodDialog } from "@/components/pods/pod-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { usePersonalNotes } from "@/lib/library";
import { usePods, useUsage } from "@/lib/queries";
import { UNLIMITED, limitLabel, planFor } from "@/lib/tiers";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Dashboard — Study Notes" },
      { name: "description", content: "Your study pods, usage and shared course material." },
      { property: "og:title", content: "Dashboard — Study Notes" },
      { property: "og:description", content: "Your study pods, usage and shared course material." },
    ],
  }),
  component: DashboardPage,
});

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit === UNLIMITED ? 8 : Math.min(100, Math.round((used / limit) * 100));
  const nearLimit = limit !== UNLIMITED && used / limit >= 0.8;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={nearLimit ? "font-medium text-destructive" : "text-muted-foreground"}>
          {used} / {limitLabel(limit)}
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Mic;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group surface flex items-center gap-4 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
    </button>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="display text-xl leading-none font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { user, profile } = useAuth();
  const pods = usePods(user?.id);
  const usage = useUsage(user?.id);
  const personalNotes = usePersonalNotes(user?.id);
  const plan = planFor(profile?.tier);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const recordRef = useRef<HTMLDivElement>(null);

  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const isNewUser = Boolean(
    user?.created_at && Date.now() - new Date(user.created_at).getTime() < 24 * 60 * 60 * 1000,
  );
  const greeting = isNewUser ? `Welcome, ${firstName}!` : `Welcome back, ${firstName}!`;

  const recentNotes = (personalNotes.data ?? []).slice(0, 3);

  function goToRecording() {
    recordRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToLibrary() {
    setActiveTab("library");
    requestAnimationFrame(() => {
      document.getElementById("dashboard-tabs")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  return (
    <div className="space-y-10">
      {/* ── Welcome hero ─────────────────────────────────────────── */}
      <section className="rise-in relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              <Sparkles className="size-3.5" /> {plan.tier} plan
            </Badge>
            <h1 className="display text-3xl font-semibold tracking-tight sm:text-4xl">
              {greeting}
            </h1>
            <p className="text-muted-foreground">
              Ready to make progress today? Record a lecture, tidy your notes, or pick up a
              conversation in your pods.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setJoinOpen(true)} variant="outline">
              <UserPlus className="size-4" /> Join pod
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Create pod
            </Button>
          </div>
        </div>

        <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
          <QuickAction
            icon={Mic}
            title="Record Lecture"
            description="Capture audio with live transcription"
            onClick={goToRecording}
          />
          <QuickAction
            icon={FileText}
            title="Create Note"
            description="Start from a recording or a blank page"
            onClick={goToLibrary}
          />
          <QuickAction
            icon={Users}
            title="Join Study Pod"
            description="Enter an invite code from a classmate"
            onClick={() => setJoinOpen(true)}
          />
        </div>
      </section>

      {/* ── Activity at a glance (real counts only) ──────────────── */}
      <section className="rise-in-late grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatPill icon={Users} label="Study pods" value={usage.data?.pods ?? 0} />
        <StatPill icon={FileText} label="Notes" value={usage.data?.notes ?? 0} />
        <StatPill icon={BookOpen} label="Flashcards" value={usage.data?.flashcards ?? 0} />
        <StatPill icon={FileAudio} label="Recordings" value={usage.data?.recordings ?? 0} />
      </section>

      {/* ── Plan usage ───────────────────────────────────────────── */}
      <Card className="rise-in-late">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="display text-lg">{plan.tier} plan usage</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
          </div>
          {plan.tier === "Free" ? (
            <Button asChild variant="outline" size="sm">
              <a href="/billing">Upgrade</a>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Meter label="Pods" used={usage.data?.pods ?? 0} limit={plan.maxPods} />
          <Meter label="Notes" used={usage.data?.notes ?? 0} limit={plan.maxNotes} />
          <Meter label="Flashcards" used={usage.data?.flashcards ?? 0} limit={plan.maxFlashcards} />
          <Meter label="Recordings" used={usage.data?.recordings ?? 0} limit={plan.maxRecordings} />
        </CardContent>
      </Card>

      {/* ── Recording hub ────────────────────────────────────────── */}
      <div ref={recordRef} className="rise-in-later scroll-mt-20">
        <AudioHub pods={pods.data} userId={user?.id} />
      </div>

      {/* ── Recent from your library ─────────────────────────────── */}
      <section className="rise-in-later space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="display text-xl font-semibold">Recent notes & recordings</h2>
          {recentNotes.length ? (
            <Button variant="ghost" size="sm" onClick={goToLibrary}>
              View library <ArrowRight className="size-4" />
            </Button>
          ) : null}
        </div>

        {personalNotes.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : recentNotes.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {recentNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={goToLibrary}
                className="surface group flex flex-col gap-2 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    {note.audio_url ? <FileAudio className="size-4" /> : <FileText className="size-4" />}
                  </span>
                  <p className="truncate text-sm font-medium">{note.title}</p>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {note.transcript || note.summary || "No transcript yet"}
                </p>
                <p className="mt-auto text-[11px] text-muted-foreground">
                  {new Date(note.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Library}
            title="Nothing saved yet"
            description="Your recordings and notes will appear here. Record your first lecture to get started."
            action={
              <Button onClick={goToRecording} size="sm">
                <Mic className="size-4" /> Record a lecture
              </Button>
            }
          />
        )}
      </section>

      {/* ── Pods / Library / Discover ────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="rise-in-later space-y-6"
        id="dashboard-tabs"
      >
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="active">My Active Pods</TabsTrigger>
          <TabsTrigger value="library">Personal Library</TabsTrigger>
          <TabsTrigger value="discover">Discover</TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <PersonalLibrary userId={user?.id} pods={pods.data} />
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="display text-xl font-semibold">Your pods</h2>
            <div className="flex gap-2">
              <Button onClick={() => setJoinOpen(true)} variant="outline" size="sm">
                <UserPlus className="size-4" /> Join
              </Button>
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="size-4" /> Create
              </Button>
            </div>
          </div>

          {pods.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : pods.data?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pods.data.map((pod) => (
                <PodCard key={pod.id} pod={pod} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Compass}
              title="No pods yet"
              description="Create one for your course, or join with an invite code from a classmate."
              action={
                <div className="flex gap-2">
                  <Button onClick={() => setCreateOpen(true)} size="sm">
                    Create your first pod
                  </Button>
                  <Button variant="outline" onClick={() => setJoinOpen(true)} size="sm">
                    Join a pod
                  </Button>
                </div>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="discover">
          <DiscoverTab />
        </TabsContent>
      </Tabs>

      <CreatePodDialog open={createOpen} onOpenChange={setCreateOpen} userId={user?.id} />
      <JoinPodDialog open={joinOpen} onOpenChange={setJoinOpen} />
      <AiAssistant />
    </div>
  );
}
