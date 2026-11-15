import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronDown,
  Compass,
  FileAudio,
  FileText,
  Library,
  Mic,
  Plus,
  Sparkles,
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
      className="h-12 justify-center gap-3 px-5 shadow-none"
    >
      <Icon className="size-4" />
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
    <div className="space-y-10 pb-6 sm:space-y-12">
      {/* ── Welcome hero ─────────────────────────────────────────── */}
      <section className="space-y-7 pt-2 sm:pt-4">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Your study workspace</p>
            <h1 className="text-3xl leading-tight font-semibold tracking-normal sm:text-4xl">
              {greeting}
            </h1>
            <p className="text-base text-muted-foreground">
              Ready to make progress today?
            </p>
          </div>
        <div className="grid gap-3 sm:grid-cols-3 sm:max-w-2xl">
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

      {/* ── Recording hub ────────────────────────────────────────── */}
      <div ref={recordRef} className="scroll-mt-24">
        <AudioHub pods={pods.data} userId={user?.id} />
      </div>

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_260px] xl:gap-10">
      <div className="min-w-0 space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-normal">Recent activity</h2>
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
          <div className="divide-y divide-border border-y border-border">
            {recentNotes.map((note) => (
              <Button
                key={note.id}
                type="button"
                onClick={goToLibrary}
                variant="ghost"
                className="flex h-auto min-h-24 w-full items-center justify-start gap-4 rounded-none px-2 py-4 text-left whitespace-normal"
              >
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
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
            <div className="grid gap-4 sm:grid-cols-2">
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

      <aside className="space-y-8 border-t border-border pt-8 xl:border-t-0 xl:border-l xl:pl-8 xl:pt-0">
        <section className="space-y-5">
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
        <AiAssistant inline />
      </aside>
      </div>

      <CreatePodDialog open={createOpen} onOpenChange={setCreateOpen} userId={user?.id} />
      <JoinPodDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
