import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Check, FileText, Layers, Link2, MessageCircle, Pin, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatTab } from "@/components/pods/chat-tab";
import { FlashcardsTab } from "@/components/pods/flashcards-tab";
import { NotesTab } from "@/components/pods/notes-tab";
import { QuizzesTab } from "@/components/pods/quizzes-tab";
import { useAuth } from "@/hooks/use-auth";
import { initials, usePod, usePodMembers } from "@/lib/queries";

function inviteLink(code: string) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${code}`;
}

export const Route = createFileRoute("/_authenticated/pod/$podId")({
  head: () => ({
    meta: [
      { title: "Pod workspace — Study Notes" },
      { name: "description", content: "Your shared study space for notes, recordings, flashcards, quizzes and group chat." },
      { property: "og:title", content: "Pod workspace — Study Notes" },
      { property: "og:description", content: "Your shared study space for notes, recordings, flashcards, quizzes and group chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PodWorkspacePage,
});

function PodWorkspacePage() {
  const { podId } = Route.useParams();
  const { user } = useAuth();
  const pod = usePod(podId);
  const members = usePodMembers(podId);
  const [copied, setCopied] = useState(false);

  async function copyInvite(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the invite link");
    }
  }

  if (pod.isLoading) {
    return <div className="space-y-6"><Skeleton className="h-44 rounded-lg" /><Skeleton className="h-12 rounded-lg" /><Skeleton className="h-80 rounded-lg" /></div>;
  }
  if (pod.isError || !pod.data) {
    return (
      <div className="py-16 text-center">
        <Users className="mx-auto mb-4 size-10 text-muted-foreground" />
        <h1 className="display mb-2 text-2xl font-semibold">Pod unavailable</h1>
        <p className="text-muted-foreground">This pod doesn't exist or you're not a member.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/dashboard"><ArrowLeft className="size-4" /> Back to dashboard</Link></Button>
      </div>
    );
  }

  const currentPod = pod.data;
  const code = currentPod.invite_code;
  const list = members.data ?? [];

  return (
    <div className="min-w-0 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/dashboard"><ArrowLeft className="size-4" /> Dashboard</Link>
      </Button>
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground sm:size-16"><BookOpen className="size-7" /></span>
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Study pod</span>
              {currentPod.course_code ? <Badge variant="secondary">{currentPod.course_code}</Badge> : null}
            </div>
            <h1 className="display break-words text-3xl font-semibold leading-tight sm:text-4xl">{currentPod.name}</h1>
            {currentPod.description ? <p className="max-w-2xl whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">{currentPod.description}</p> : null}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex -space-x-2">
                {list.slice(0, 5).map((member) => <Avatar key={member.user_id} className="size-7 border-2 border-background"><AvatarImage src={member.avatar_url ?? undefined} alt={member.full_name} /><AvatarFallback className="text-[10px]">{initials(member.full_name)}</AvatarFallback></Avatar>)}
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" />{list.length} member{list.length === 1 ? "" : "s"}</span>
              {code ? <span className="rounded-md border border-dashed border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">{code}</span> : null}
            </div>
          </div>
        </div>
        {code ? (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button size="sm" variant="outline" onClick={() => void copyInvite(inviteLink(code))}>{copied ? <Check className="size-4" /> : <Link2 className="size-4" />} Copy invite link</Button>
            <Button size="sm" variant="secondary" asChild><a href={`https://wa.me/?text=${encodeURIComponent(`Join my study pod "${currentPod.name}" on Study Notes: ${inviteLink(code)}`)}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4" /> Share to WhatsApp</a></Button>
          </div>
        ) : null}
      </header>
      {currentPod.description || currentPod.rules ? (
        <section className="flex items-start gap-3 border-l-2 border-primary bg-accent/40 px-4 py-3">
          <Pin className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 space-y-1.5">
            <h2 className="font-sans text-sm font-semibold">Pinned Resources &amp; Rules</h2>
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">{currentPod.rules || currentPod.description}</p>
          </div>
        </section>
      ) : null}
      <Tabs defaultValue="notes" className="min-w-0 gap-6">
        <TabsList className="grid h-auto w-full grid-cols-4 rounded-none border-b border-border bg-transparent p-0">
          {([{ value: "notes", label: "Notes", icon: FileText }, { value: "flashcards", label: "Flashcards", icon: Layers }, { value: "quizzes", label: "Quizzes", icon: Sparkles }, { value: "chat", label: "Chat", icon: MessageCircle }]).map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="min-w-0 flex-col gap-1.5 rounded-none border-b-2 border-transparent px-1 py-3 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:flex-row sm:gap-2 sm:text-sm"><Icon className="size-4 shrink-0" />{label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="notes" className="min-w-0"><NotesTab podId={podId} userId={user?.id} /></TabsContent>
        <TabsContent value="flashcards" className="min-w-0"><FlashcardsTab podId={podId} userId={user?.id} /></TabsContent>
        <TabsContent value="quizzes" className="min-w-0"><QuizzesTab podId={podId} /></TabsContent>
        <TabsContent value="chat" className="min-w-0"><ChatTab podId={podId} userId={user?.id} /></TabsContent>
      </Tabs>
    </div>
  );
}
