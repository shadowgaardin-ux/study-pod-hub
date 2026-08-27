import { createFileRoute } from "@tanstack/react-router";
import { Plus, UserPlus } from "lucide-react";
import { useState } from "react";

import { PodCard } from "@/components/pods/pod-card";
import { CreatePodDialog, JoinPodDialog } from "@/components/pods/pod-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { usePods } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/pods")({
  head: () => ({
    meta: [
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl font-semibold tracking-tight">My pods</h1>
          <p className="text-muted-foreground">Shared workspaces for each of your courses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            <UserPlus className="size-4" /> Join
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New pod
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
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            You are not in any pod yet.
          </CardContent>
        </Card>
      )}

      <CreatePodDialog open={createOpen} onOpenChange={setCreateOpen} userId={user?.id} />
      <JoinPodDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
