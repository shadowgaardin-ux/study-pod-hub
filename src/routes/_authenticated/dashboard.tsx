import { Link, createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronDown,
  Compass,
  FileAudio,
  FileText,
  Library,
  Mic,
  Plus,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AiAssistant } from "@/components/ai/ai-assistant";
import { AudioHub } from "@/components/dashboard/audio-hub";
import { PersonalLibrary } from "@/components/dashboard/personal-library";
import { NoteViewer } from "@/components/notes/note-viewer";
import { DiscoverTab } from "@/components/pods/discover-tab";
import { PodCard } from "@/components/pods/pod-card";
import { CreatePodDialog, JoinPodDialog } from "@/components/pods/pod-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
      { title: "Dashboard — Study Pods Hub" },
      { name: "description", content: "Record lectures, revisit your notes and study together in your pods." },
      { property: "og:title", content: "Dashboard — Study Pods Hub" },
      { property: "og:description", content: "Record lectures, revisit your notes and study together in your pods." },
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
      {limit !== UNLIMITED ? <Progress value={pct} className="h-1.5" aria-label={`${label} usage`} /> : null}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  onClick,
}: {
  icon: typeof Mic;
  title: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant={title === "Record Lecture" ? "default" : "outline"}
      className="lift h-12 justify-center gap-3 px-5 shadow-none"
    >
      <Icon className={`size-4 ${title === "Record Lecture" ? "" : title === "Create Note" ? "text-brand-teal" : "text-brand-purple"}`} />
      {title}
    </Button>
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
  const hash = useRouterState({ select: (state) => state.location.hash });
  const [viewingId, setViewingId] = useState<string | null>(null);

  useEffect(() => {
    if (hash === "library") setActiveTab("library");
    const target = hash === "library" ? "dashboard-tabs" : hash === "recording" ? "recording" : hash === "assistant" ? "assistant" : null;
    if (!target) return;
    const frame = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const isNewUser = Boolean(
    user?.created_at && Date.now() - new Date(user.created_at).getTime() < 24 * 60 * 60 * 1000,
  );
  const greeting = isNewUser ? `Welcome, ${firstName}!` : `Welcome back, ${firstName}!`;

  const recentNotes = (personalNotes.data ?? []).slice(0, 3);

  function goToRecording() {
    recordRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }

  function goToLibrary() {
    setActiveTab("library");
    requestAnimationFrame(() => {
      document.getElementById("dashboard-tabs")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  }

  return (
    <div className="min-w-0 space-y-7 pb-6 sm:space-y-8">
      {/* ── Welcome hero ─────────────────────────────────────────── */}
      <section className="flex flex-wrap items-center justify-between gap-6 border-b border-border pb-7">
          <div className="min-w-0 max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase text-brand-sky">Study Pods Hub</p>
            <h1 className="text-2xl leading-tight font-bold sm:text-3xl">
              {greeting} <span className="inline-block transition-transform hover:rotate-12" aria-hidden>👋</span>
            </h1>
            <p className="text-base text-muted-foreground">
              A little focus. A little collaboration. A lot of progress.
            </p>
          </div>
        <div className="stagger grid w-full gap-2 min-[480px]:grid-cols-3 2xl:w-auto">
          <QuickAction
            icon={Mic}
            title="Record Lecture"
            onClick={goToRecording}
          />
          <QuickAction
            icon={FileText}
            title="Create Note"
            onClick={goToLibrary}
          />
          <QuickAction
            icon={Users}
            title="Join Study Pod"
            onClick={() => setJoinOpen(true)}
          />
        </div>
      </section>

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-8">
      <div ref={recordRef} id="recording" className="scroll-mt-28">
        <AudioHub pods={pods.data} userId={user?.id} />
      </div>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Library className="size-4 text-brand-purple" /> Recent notes & recordings</h2>
          {recentNotes.length ? (
            <Button variant="ghost" size="sm" onClick={goToLibrary}>
              View all <ArrowRight className="size-4" />
            </Button>
          ) : null}
        </div>

        {personalNotes.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-md" />
            ))}
          </div>
        ) : recentNotes.length ? (
          <div className="stagger space-y-3">
            {recentNotes.map((note) => (
              <Button
                key={note.id}
                type="button"
                onClick={() => setViewingId(note.id)}
                variant="ghost"
                className="lift flex h-auto min-h-24 w-full items-center justify-start gap-4 rounded-lg border border-border bg-card p-4 text-left whitespace-normal hover:bg-secondary"
              >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-md ${note.audio_url ? "bg-brand-pink/10 text-brand-pink" : "bg-brand-sky/10 text-brand-sky"}`}>
                    {note.audio_url ? <FileAudio className="size-4" /> : <FileText className="size-4" />}
                  </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate text-sm font-medium">{note.title}</span>
                <span className="line-clamp-1 text-xs font-normal text-muted-foreground">
                  {note.transcript || note.summary || "No transcript yet"}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Library}
            title="Nothing saved yet"
            description="Your personal notes and recordings."
          />
        )}
      </section>

      {/* ── Pods / Library / Discover ────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="min-w-0 space-y-6 scroll-mt-24"
        id="dashboard-tabs"
      >
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="active" className="rounded-none border-b-2 border-transparent py-3 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:text-sm">Study Pods</TabsTrigger>
          <TabsTrigger value="library" className="rounded-none border-b-2 border-transparent py-3 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:text-sm">My Library</TabsTrigger>
          <TabsTrigger value="discover" className="rounded-none border-b-2 border-transparent py-3 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:text-sm">Discover</TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <PersonalLibrary userId={user?.id} pods={pods.data} />
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-normal">Your study pods</h2>
              <Button onClick={() => setCreateOpen(true)} variant="outline" size="sm">
                <Plus className="size-4" /> Create pod
              </Button>
          </div>

          {pods.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32 rounded-md" />
              ))}
            </div>
          ) : pods.data?.length ? (
            <div className="stagger grid gap-4 sm:grid-cols-2">
              {pods.data.map((pod) => (
                <PodCard key={pod.id} pod={pod} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Compass}
              title="No pods yet"
              description="Create one for your course, or join with an invite code from a classmate."
            />
          )}
        </TabsContent>

        <TabsContent value="discover">
          <DiscoverTab />
        </TabsContent>
      </Tabs>
      </div>

      <aside className="min-w-0 space-y-6">
        <div id="assistant" className="scroll-mt-28"><AiAssistant inline /></div>
        <section className="space-y-5 border-t border-border pt-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-normal">Plan usage</h2>
            <Badge variant="secondary">{plan.tier}</Badge>
          </div>
          {usage.isLoading ? <Skeleton className="h-8" /> : <Meter label="Recordings" used={usage.data?.recordings ?? 0} limit={plan.maxRecordings} />}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="group w-full justify-between px-0 text-muted-foreground">
                All usage <ChevronDown className="size-4 transition-transform motion-reduce:transition-none group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-5 pt-4">
              <Meter label="Pods" used={usage.data?.pods ?? 0} limit={plan.maxPods} />
              <Meter label="Notes" used={usage.data?.notes ?? 0} limit={plan.maxNotes} />
              <Meter label="Flashcards" used={usage.data?.flashcards ?? 0} limit={plan.maxFlashcards} />
            </CollapsibleContent>
          </Collapsible>
          {plan.tier === "Free" ? <Button asChild variant="link" size="sm" className="h-auto px-0"><Link to="/billing">Upgrade plan <ArrowRight className="size-4" /></Link></Button> : null}
        </section>
      </aside>
      </div>

      <CreatePodDialog open={createOpen} onOpenChange={setCreateOpen} userId={user?.id} />
      <JoinPodDialog open={joinOpen} onOpenChange={setJoinOpen} />
      <NoteViewer note={personalNotes.data?.find((note) => note.id === viewingId) ?? null} userId={user?.id} onOpenChange={(open) => !open && setViewingId(null)} />
    </div>
  );
}
