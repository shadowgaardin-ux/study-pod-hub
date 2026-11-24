import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Compass, FileAudio, FileText, Library, Plus, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { AiAssistant } from "@/components/ai/ai-assistant";
import { AudioHub } from "@/components/dashboard/audio-hub";
import { PersonalLibrary } from "@/components/dashboard/personal-library";
import { NoteViewer } from "@/components/notes/note-viewer";
import { DiscoverTab } from "@/components/pods/discover-tab";
import { PodCard } from "@/components/pods/pod-card";
import { CreatePodDialog, JoinPodDialog } from "@/components/pods/pod-dialogs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/hooks/use-auth";
import { usePersonalNotes } from "@/lib/library";
import { usePods } from "@/lib/queries";

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

function DashboardPage() {
  const { user, profile } = useAuth();
  const pods = usePods(user?.id);
  const personalNotes = usePersonalNotes(user?.id);
  const navigate = useNavigate();
  const hash = useRouterState({ select: (state) => state.location.hash });
  const libraryOpen = hash === "library";
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("library");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const latestNote = personalNotes.data?.[0];

  return (
    <div className="mx-auto min-w-0 max-w-4xl">
      {/* Keep capture mounted when switching to the library so recordings are not interrupted. */}
      <div hidden={libraryOpen}>
        <section className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <p className="mb-3 text-xs text-muted-foreground sm:mb-5">Welcome back, {firstName}</p>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-brand-sky"><Sparkles className="size-3.5" />Your AI study space</p>
          <h1 data-tour="dashboard-hero" className="text-3xl leading-tight font-bold sm:text-4xl">Study Pods Hub</h1>
          <p className="mt-3 text-lg font-medium text-foreground">Less note-taking. More understanding.</p>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Record your lectures and turn them into transcripts, summaries, bullet points, flashcards and quizzes with AI.</p>
          <div id="recording" className="mt-2 w-full scroll-mt-28">
            <AudioHub pods={pods.data} userId={user?.id} focus />
          </div>
          <div id="assistant" className="mt-3 flex flex-wrap items-center justify-center gap-1 sm:gap-4">
            <span data-tour="dashboard-assistant" className="inline-flex"><AiAssistant inline compact /></span>
            <Button data-tour="dashboard-library" variant="ghost" className="text-sm text-muted-foreground" onClick={() => void navigate({ to: "/dashboard", hash: "library" })}><Library className="size-4 text-brand-sky" />My Library</Button>
            <Button data-tour="dashboard-pods" variant="ghost" className="text-sm text-muted-foreground" onClick={() => setJoinOpen(true)}><Users className="size-4 text-brand-amber" />Join a pod</Button>
          </div>
        </section>
        {latestNote && <section className="mx-auto mt-5 max-w-xl border-t border-border pt-3">
          <Button variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2 text-left" onClick={() => setViewingId(latestNote.id)}>
            {latestNote.audio_url ? <FileAudio className="size-4 shrink-0 text-brand-sky" /> : <FileText className="size-4 shrink-0 text-ai" />}
            <span className="min-w-0 flex-1"><span className="block text-xs font-normal text-muted-foreground">Pick up where you left off</span><span className="block truncate text-sm">{latestNote.title}</span></span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </section>}
      </div>
      {libraryOpen && <section className="space-y-6">
        <PageHeader icon={Library} eyebrow="Your study space" title="My Library" description="Private recordings and notes, your pods and public pods to discover." actions={<Button variant="outline" onClick={() => void navigate({ to: "/dashboard", hash: "" })}>Back to dashboard <ArrowRight className="size-4" /></Button>} />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6" id="dashboard-tabs">
          <TabsList className="grid h-auto w-full grid-cols-3 sm:max-w-md">
            <TabsTrigger value="library">My Library</TabsTrigger>
            <TabsTrigger value="active">Study Pods</TabsTrigger>
            <TabsTrigger value="discover">Discover</TabsTrigger>
          </TabsList>
          <TabsContent value="library"><PersonalLibrary userId={user?.id} pods={pods.data} /></TabsContent>
          <TabsContent value="active" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Your study pods</h2><Button onClick={() => setCreateOpen(true)} variant="outline" size="sm"><Plus className="size-4" />Create pod</Button></div>
            {pods.isLoading ? <Skeleton className="h-32" /> : pods.data?.length ? <div className="grid gap-4 sm:grid-cols-2">{pods.data.map((pod) => <PodCard key={pod.id} pod={pod} />)}</div> : <EmptyState icon={Compass} title="No pods yet" description="Create one for your course, or join with an invite code from a classmate." />}
          </TabsContent>
          <TabsContent value="discover"><DiscoverTab /></TabsContent>
        </Tabs>
      </section>}
      <CreatePodDialog open={createOpen} onOpenChange={setCreateOpen} userId={user?.id} />
      <JoinPodDialog open={joinOpen} onOpenChange={setJoinOpen} />
      <NoteViewer note={personalNotes.data?.find((note) => note.id === viewingId) ?? null} userId={user?.id} onOpenChange={(open) => !open && setViewingId(null)} />
    </div>
  );
}
