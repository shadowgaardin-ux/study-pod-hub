import { createFileRoute } from "@tanstack/react-router";
import { Plus, UserPlus } from "lucide-react";
import { useState } from "react";

import { PodCard } from "@/components/pods/pod-card";
import { CreatePodDialog, JoinPodDialog } from "@/components/pods/pod-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { usePods, useUsage } from "@/lib/queries";
import { UNLIMITED, limitLabel, planFor } from "@/lib/tiers";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
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
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {used} / {limitLabel(limit)}
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

function DashboardPage() {
  const { user, profile } = useAuth();
  const pods = usePods(user?.id);
  const usage = useUsage(user?.id);
  const plan = planFor(profile?.tier);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl font-semibold tracking-tight">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground">Pick up where your study pods left off.</p>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="display text-lg">{plan.tier} plan usage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          <Meter label="Pods" used={usage.data?.pods ?? 0} limit={plan.maxPods} />
          <Meter label="Notes" used={usage.data?.notes ?? 0} limit={plan.maxNotes} />
          <Meter label="Flashcards" used={usage.data?.flashcards ?? 0} limit={plan.maxFlashcards} />
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="display text-xl font-semibold">Your pods</h2>
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
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-muted-foreground">
                No pods yet. Create one for your course, or join with an invite code.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setCreateOpen(true)}>Create your first pod</Button>
                <Button variant="outline" onClick={() => setJoinOpen(true)}>
                  Join a pod
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <CreatePodDialog open={createOpen} onOpenChange={setCreateOpen} userId={user?.id} />
      <JoinPodDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
