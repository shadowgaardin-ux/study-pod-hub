import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, FileText, Link2, MoreVertical, Pin, UserMinus, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage } from "@/lib/chat";
import { initials, usePod, usePodMembers } from "@/lib/queries";

import { AudioAttachment, DocAttachment, ImageAttachment } from "./chat-parts";

export function HubPanel({
  podId,
  userId,
  isAdmin,
  messages,
  onJump,
}: {
  podId: string;
  userId: string | undefined;
  isAdmin: boolean;
  messages: ChatMessage[];
  onJump: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const pod = usePod(podId);
  const members = usePodMembers(podId);
  const requests = useQuery({
    queryKey: ["join-requests", podId],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pod_join_request_profiles", { _pod_id: podId });
      if (error) throw error;
      return data ?? [];
    },
  });

  const live = messages.filter((m) => !m.deleted_at);
  const images = live.filter((m) => m.kind === "image");
  const docs = live.filter((m) => m.kind === "file");
  const audio = live.filter((m) => m.kind === "voice" || m.kind === "audio");
  const pinned = live.filter((m) => m.pinned_at);

  async function setRole(memberId: string, role: "admin" | "member") {
    const { error } = await supabase
      .from("pod_members")
      .update({ role })
      .eq("pod_id", podId)
      .eq("user_id", memberId);
    if (error) return toast.error(error.message);
    toast.success(role === "admin" ? "Made hub admin" : "Admin removed");
    void queryClient.invalidateQueries({ queryKey: ["pod-members", podId] });
  }

  async function remove(memberId: string) {
    const { error } = await supabase.from("pod_members").delete().eq("pod_id", podId).eq("user_id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Removed from hub");
    void queryClient.invalidateQueries({ queryKey: ["pod-members", podId] });
  }

  async function decide(id: string, status: "approved" | "declined") {
    const { error } = await supabase.from("pod_join_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Request approved" : "Request declined");
    void queryClient.invalidateQueries({ queryKey: ["join-requests", podId] });
    void queryClient.invalidateQueries({ queryKey: ["pod-members", podId] });
  }

  async function copyInvite() {
    if (!pod.data?.invite_code) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join?code=${pod.data.invite_code}`);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy the invite link");
    }
  }

  const reqs = requests.data ?? [];

  return (
    <Tabs defaultValue="members" className="flex h-full flex-col">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="media">Media</TabsTrigger>
        <TabsTrigger value="docs">Docs</TabsTrigger>
        <TabsTrigger value="pinned">Pinned</TabsTrigger>
      </TabsList>

      <TabsContent value="members" className="flex-1 space-y-4 overflow-y-auto">
        {pod.data?.invite_code ? (
          <Button variant="outline" className="w-full" onClick={() => void copyInvite()}>
            <Link2 className="size-4" /> Copy invite link
          </Button>
        ) : null}

        {isAdmin && reqs.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Join requests ({reqs.length})
            </p>
            {reqs.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                <Avatar className="size-8">
                  <AvatarImage src={r.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>{initials(r.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.full_name || "Student"}</p>
                  {r.message ? <p className="truncate text-xs text-muted-foreground">{r.message}</p> : null}
                </div>
                <Button size="icon" variant="ghost" aria-label="Approve" onClick={() => void decide(r.id, "approved")}>
                  <Check className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Decline" onClick={() => void decide(r.id, "declined")}>
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {members.data?.length ?? 0} members
          </p>
          {members.data?.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
              <Avatar className="size-9">
                <AvatarImage src={m.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
              </Avatar>
              <p className="min-w-0 flex-1 truncate text-sm">
                {m.full_name || "Member"}
                {m.user_id === userId ? <span className="text-muted-foreground"> (you)</span> : null}
              </p>
              {m.role === "admin" ? (
                <Badge variant="secondary" className="gap-1">
                  <Crown className="size-3" /> Admin
                </Badge>
              ) : null}
              {isAdmin && m.user_id !== userId ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label={`Manage ${m.full_name}`}>
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {m.role === "admin" ? (
                      <DropdownMenuItem onClick={() => void setRole(m.user_id, "member")}>Dismiss as admin</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => void setRole(m.user_id, "admin")}>Make hub admin</DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-destructive" onClick={() => void remove(m.user_id)}>
                      <UserMinus className="size-4" /> Remove from hub
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="media" className="flex-1 space-y-4 overflow-y-auto">
        {images.length ? (
          <div className="grid grid-cols-2 gap-2">
            {images.map((m) => (
              <ImageAttachment key={m.id} message={m} />
            ))}
          </div>
        ) : (
          <Empty text="No photos shared yet" />
        )}
        {audio.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audio & voice notes</p>
            {audio.map((m) => (
              <div key={m.id} className="rounded-lg bg-muted p-2">
                <AudioAttachment message={m} mine={false} />
              </div>
            ))}
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="docs" className="flex-1 space-y-2 overflow-y-auto">
        {docs.length ? docs.map((m) => <DocAttachment key={m.id} message={m} />) : <Empty text="No documents shared yet" icon />}
      </TabsContent>

      <TabsContent value="pinned" className="flex-1 space-y-2 overflow-y-auto">
        {pinned.length ? (
          pinned.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onJump(m.id)}
              className="flex w-full items-start gap-2 rounded-lg border border-border p-3 text-left text-sm hover:bg-muted/50"
            >
              <Pin className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span className="line-clamp-3">{m.message || m.attachment_name || "Attachment"}</span>
            </button>
          ))
        ) : (
          <Empty text={isAdmin ? "Pin important messages from the message menu" : "No pinned messages"} />
        )}
      </TabsContent>
    </Tabs>
  );
}

function Empty({ text, icon }: { text: string; icon?: boolean }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {icon ? <FileText className="mx-auto mb-2 size-6" /> : null}
      {text}
    </div>
  );
}
