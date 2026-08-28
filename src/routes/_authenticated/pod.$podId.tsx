import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy, Users } from "lucide-react";
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

  async function copyInvite(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Invite code copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the invite code");
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
            <Badge variant="secondary">{pod.data.course_code}</Badge>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {list.length} member{list.length === 1 ? "" : "s"}
            </span>
            {pod.data.invite_code ? (
              <button
                type="button"
                onClick={() => void copyInvite(pod.data.invite_code!)}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 font-mono text-xs hover:bg-accent"
                title="Copy invite code"
              >
                {pod.data.invite_code}
                {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
              </button>
            ) : null}
          </div>
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
