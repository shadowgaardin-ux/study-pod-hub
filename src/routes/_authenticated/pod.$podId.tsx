import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Link2, MessageCircle, Pin, Users } from "lucide-react";
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
      { name: "description", content: "Collaborate on notes, flashcards, quizzes, and chat." },
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
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (pod.isError || !pod.data) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">
          This pod doesn't exist or you're not a member.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" /> Back to dashboard
          </Link>
        </Button>
      </div>
    );
  }

  const list = members.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" /> Dashboard
            </Link>
          </Button>
          <h1 className="display text-2xl font-bold tracking-tight sm:text-3xl">
            {pod.data.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {pod.data.course_code ? <Badge variant="secondary">{pod.data.course_code}</Badge> : null}
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {list.length} member{list.length === 1 ? "" : "s"}
            </span>
            {pod.data.invite_code ? (
              <span className="rounded-md border border-dashed border-border px-2 py-0.5 font-mono text-xs">
                {pod.data.invite_code}
              </span>
            ) : null}
          </div>
          {pod.data.invite_code ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => void copyInvite(inviteLink(pod.data.invite_code!))}>
                {copied ? <Check className="size-4" /> : <Link2 className="size-4" />} Copy invite link
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Join my study pod "${pod.data.name}" on Study Notes: ${inviteLink(pod.data.invite_code)}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" /> Share to WhatsApp
                </a>
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex -space-x-2">
          {list.slice(0, 6).map((member) => (
            <Avatar key={member.user_id} className="size-9 border-2 border-background">
              <AvatarImage src={member.avatar_url ?? undefined} alt={member.full_name} />
              <AvatarFallback>{initials(member.full_name)}</AvatarFallback>
            </Avatar>
          ))}
          {list.length > 6 ? (
            <div className="flex size-9 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
              +{list.length - 6}
            </div>
          ) : null}
        </div>
      </div>

      {pod.data.description || pod.data.rules ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Pin className="size-3.5" /> Pinned Resources & Rules
          </p>
          {pod.data.description ? <p className="text-sm">{pod.data.description}</p> : null}
          {pod.data.rules ? (
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{pod.data.rules}</p>
          ) : null}
        </div>
      ) : null}

      <Tabs defaultValue="notes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>
        <TabsContent value="notes">
          <NotesTab podId={podId} userId={user?.id} />
        </TabsContent>
        <TabsContent value="flashcards">
          <FlashcardsTab podId={podId} userId={user?.id} />
        </TabsContent>
        <TabsContent value="quizzes">
          <QuizzesTab />
        </TabsContent>
        <TabsContent value="chat">
          <ChatTab podId={podId} userId={user?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
