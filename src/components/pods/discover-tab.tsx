import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Clock, Search, Ticket, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface DiscoverPod {
  id: string;
  name: string;
  course_code: string;
  description: string | null;
  is_public: boolean;
  member_count: number;
  request_status: string | null;
}

export function DiscoverTab() {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const pods = useQuery({
    queryKey: ["discover-pods", search],
    queryFn: async (): Promise<DiscoverPod[]> => {
      const { data, error } = await supabase.rpc("discover_pods", { _search: search || undefined });
      if (error) throw error;
      return (data ?? []) as DiscoverPod[];
    },
  });

  const request = useMutation({
    mutationFn: async (podId: string) => {
      const { data, error } = await supabase.rpc("request_pod_access", { _pod_id: podId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async (status) => {
      toast.success(status === "member" ? "You're in — pod joined" : "Request sent to the pod admins");
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function joinByCode(event: React.FormEvent) {
    event.preventDefault();
    setJoining(true);
    const { data, error } = await supabase.rpc("join_pod_by_code", { _invite_code: code.trim() });
    setJoining(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Joined pod");
    setCode("");
    await queryClient.invalidateQueries();
    void navigate({ to: "/pod/$podId", params: { podId: data as string } });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(term.trim());
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search pods by name or course code"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <form onSubmit={joinByCode} className="flex gap-2">
          <div className="relative">
            <Ticket className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="INVITE"
              maxLength={6}
              className="w-36 pl-9 font-mono tracking-[0.25em] uppercase"
            />
          </div>
          <Button type="submit" disabled={joining || code.trim().length < 4}>
            {joining ? "Joining…" : "Join"}
          </Button>
        </form>
      </div>

      {pods.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : pods.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pods.data.map((pod) => (
            <Card key={pod.id} className="transition-shadow hover:shadow-[var(--shadow-lift)]">
              <CardContent className="flex h-full flex-col gap-3 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{pod.name}</h3>
                    {pod.course_code && (
                      <p className="text-xs text-muted-foreground">{pod.course_code}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    <Users className="size-3" />
                    {pod.member_count}
                  </Badge>
                </div>
                <p className="grow text-sm text-muted-foreground">
                  {pod.description || "No description yet."}
                </p>
                {pod.request_status === "pending" ? (
                  <Button variant="outline" disabled className="gap-2">
                    <Clock className="size-4" /> Request pending
                  </Button>
                ) : (
                  <Button
                    onClick={() => request.mutate(pod.id)}
                    disabled={request.isPending}
                    variant="outline"
                  >
                    Request to join
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No pods match that search. Try a course code, or join with an invite code.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
