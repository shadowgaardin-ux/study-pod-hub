import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { initials, usePodMembers } from "@/lib/queries";

interface Message {
  id: string;
  pod_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export function ChatTab({ podId, userId }: { podId: string; userId: string | undefined }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const members = usePodMembers(podId);

  const messages = useQuery({
    queryKey: ["chat", podId],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("pod_discussions")
        .select("*")
        .eq("pod_id", podId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`pod-chat-${podId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pod_discussions", filter: `pod_id=eq.${podId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["chat", podId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [podId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  const byUser = new Map(members.data?.map((m) => [m.user_id, m]));

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!userId || !text.trim()) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase
      .from("pod_discussions")
      .insert({ pod_id: podId, user_id: userId, message: body });
    if (error) {
      toast.error(error.message);
      setText(body);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["chat", podId] });
  }

  return (
    <Card className="flex h-[60vh] flex-col">
      <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.data?.length ? (
          messages.data.map((message) => {
            const author = byUser.get(message.user_id);
            const mine = message.user_id === userId;
            return (
              <div key={message.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={author?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>{initials(author?.full_name)}</AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                  <p className="text-xs text-muted-foreground">
                    {author?.full_name || "Member"} ·{" "}
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <div
                    className={`mt-1 inline-block rounded-lg px-3 py-2 text-sm ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {message.message}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="py-12 text-center text-muted-foreground">
            No messages yet — say hello to your pod.
          </p>
        )}
        <div ref={bottomRef} />
      </CardContent>
      <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message your pod…"
          aria-label="Message"
        />
        <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>
    </Card>
  );
}
