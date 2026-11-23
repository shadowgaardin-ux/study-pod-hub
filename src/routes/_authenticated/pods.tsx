import { createFileRoute } from "@tanstack/react-router";
import { Plus, UserPlus, Users } from "lucide-react";
import { useState } from "react";

import { PodCard } from "@/components/pods/pod-card";
import { CreatePodDialog, JoinPodDialog } from "@/components/pods/pod-dialogs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { usePods } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/pods")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "My Pods — Study Notes" },
      { name: "description", content: "Every study pod you have created or joined." },
      { property: "og:title", content: "My Pods — Study Notes" },
      { property: "og:description", content: "Every study pod you have created or joined." },
    ],
  }),
  component: PodsPage,
});

function PodsPage() {
  const { user } = useAuth();
  const pods = usePods(user?.id);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        eyebrow="Collaborate"
        title="Study Pods"
        description="Shared workspaces for each of your courses — notes, flashcards, quizzes and chat."
        actions={
          <>
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              <UserPlus className="size-4" /> Join
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New pod
            </Button>
          </>
        }
      />

      {pods.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : pods.data?.length ? (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pods.data.map((pod) => (
            <PodCard key={pod.id} pod={pod} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="You are not in any pod yet"
          description="Create one for your course, or join with an invite code from a classmate."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Create your first pod</Button>}
        />
      )}

      <CreatePodDialog open={createOpen} onOpenChange={setCreateOpen} userId={user?.id} />
      <JoinPodDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
