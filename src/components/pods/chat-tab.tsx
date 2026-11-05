import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Copy,
  CornerUpLeft,
  Info,
  Mic,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  RotateCw,
  Send,
  Smile,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { pickMimeType } from "@/lib/audio";
import {
  CHAT_ACCEPT,
  CHAT_BUCKET,
  chatPath,
  classifyFile,
  dayKey,
  dayLabel,
  formatDuration,
  uploadWithProgress,
  validateChatFile,
  type ChatMessage,
  type ChatReaction,
} from "@/lib/chat";
import { initials, usePodMembers } from "@/lib/queries";

import { AudioAttachment, DocAttachment, EmojiPicker, ImageAttachment, QUICK_REACTIONS } from "./chat-parts";
import { HubPanel } from "./hub-panel";

interface PendingUpload {
  id: string;
  file: Blob;
  name: string;
  type: string;
  kind: "image" | "file" | "audio" | "voice";
  durationMs?: number;
  caption: string;
  replyTo: string | null;
  progress: number;
  error?: string;
}

export function ChatTab({ podId, userId }: { podId: string; userId: string | undefined }) {
  const queryClient = useQueryClient();
  const members = usePodMembers(podId);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = useQuery({
    queryKey: ["chat", podId],
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("pod_discussions")
        .select("*")
        .eq("pod_id", podId)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return ((data ?? []) as ChatMessage[]).reverse();
    },
  });

  const reactions = useQuery({
    queryKey: ["chat-reactions", podId],
    queryFn: async (): Promise<ChatReaction[]> => {
      const { data, error } = await supabase
        .from("chat_reactions")
        .select("id, message_id, user_id, emoji")
        .eq("pod_id", podId);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`hub-chat-${podId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pod_discussions", filter: `pod_id=eq.${podId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["chat", podId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions", filter: `pod_id=eq.${podId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["chat-reactions", podId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [podId, queryClient]);

  const list = messages.data ?? [];
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list.length, pending.length]);

  const byUser = useMemo(() => new Map(members.data?.map((m) => [m.user_id, m])), [members.data]);
  const byId = useMemo(() => new Map(list.map((m) => [m.id, m])), [list]);
  const reactionsBy = useMemo(() => {
    const map = new Map<string, ChatReaction[]>();
    for (const r of reactions.data ?? []) map.set(r.message_id, [...(map.get(r.message_id) ?? []), r]);
    return map;
  }, [reactions.data]);
  const isAdmin = byUser.get(userId ?? "")?.role === "admin";
  const latestPinned = [...list].reverse().find((m) => m.pinned_at && !m.deleted_at);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["chat", podId] });

  function jumpTo(id: string) {
    setInfoOpen(false);
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(id);
    setTimeout(() => setHighlight(null), 1600);
  }

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    if (!userId || !text.trim()) return;
    const body = text.trim();
    if (editing) {
      const { error } = await supabase
        .from("pod_discussions")
        .update({ message: body, edited_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      setEditing(null);
      setText("");
      return void refresh();
    }
    setText("");
    const reply = replyTo?.id ?? null;
    setReplyTo(null);
    const { error } = await supabase
      .from("pod_discussions")
      .insert({ pod_id: podId, user_id: userId, message: body, kind: "text", reply_to_id: reply });
    if (error) {
      toast.error(`Message not sent: ${error.message}`);
      setText(body);
      return;
    }
    void refresh();
  }

  async function runUpload(item: PendingUpload) {
    if (!userId) return;
    setPending((p) => p.map((x) => (x.id === item.id ? { ...x, error: undefined, progress: 0 } : x)));
    const path = chatPath(podId, userId, item.name);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired — sign in again");
      await uploadWithProgress({
        url: import.meta.env.VITE_SUPABASE_URL,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        token,
        path,
        file: item.file,
        contentType: item.type,
        onProgress: (f) => setPending((p) => p.map((x) => (x.id === item.id ? { ...x, progress: f } : x))),
      });
      const { error } = await supabase.from("pod_discussions").insert({
        pod_id: podId,
        user_id: userId,
        message: item.caption,
        kind: item.kind,
        reply_to_id: item.replyTo,
        attachment_path: path,
        attachment_name: item.name,
        attachment_type: item.type,
        attachment_size: item.file.size,
        duration_ms: item.durationMs ?? null,
      });
      if (error) {
        await supabase.storage.from(CHAT_BUCKET).remove([path]);
        throw new Error(error.message);
      }
      setPending((p) => p.filter((x) => x.id !== item.id));
      void refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setPending((p) => p.map((x) => (x.id === item.id ? { ...x, error: message } : x)));
    }
  }

  function queue(item: Omit<PendingUpload, "id" | "progress">) {
    const full = { ...item, id: crypto.randomUUID(), progress: 0 };
    setPending((p) => [...p, full]);
    void runUpload(full);
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const caption = text.trim();
    let first = true;
    for (const file of Array.from(files)) {
      const problem = validateChatFile(file);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        continue;
      }
      queue({
        file,
        name: file.name,
        type: file.type || "application/octet-stream",
        kind: classifyFile(file.name, file.type)!,
        caption: first ? caption : "",
        replyTo: first ? (replyTo?.id ?? null) : null,
      });
      first = false;
    }
    if (!first) {
      setText("");
      setReplyTo(null);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function react(message: ChatMessage, emoji: string) {
    if (!userId) return;
    const mine = reactionsBy.get(message.id)?.find((r) => r.user_id === userId && r.emoji === emoji);
    const { error } = mine
      ? await supabase.from("chat_reactions").delete().eq("id", mine.id)
      : await supabase.from("chat_reactions").insert({ message_id: message.id, pod_id: podId, user_id: userId, emoji });
    if (error) toast.error(error.message);
    void queryClient.invalidateQueries({ queryKey: ["chat-reactions", podId] });
  }

  async function remove(message: ChatMessage) {
    const { error } = await supabase
      .from("pod_discussions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", message.id);
    if (error) return toast.error(error.message);
    if (message.attachment_path) await supabase.storage.from(CHAT_BUCKET).remove([message.attachment_path]);
    void refresh();
  }

  async function togglePin(message: ChatMessage) {
    const { error } = await supabase
      .from("pod_discussions")
      .update(message.pinned_at ? { pinned_at: null, pinned_by: null } : { pinned_at: new Date().toISOString(), pinned_by: userId })
      .eq("id", message.id);
    if (error) return toast.error(error.message);
    toast.success(message.pinned_at ? "Unpinned" : "Pinned for everyone");
    void refresh();
  }

  async function copy(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.message || message.attachment_name || "");
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <Card className="flex h-[calc(100dvh-13rem)] min-h-[440px] flex-col overflow-hidden p-0 sm:h-[70vh]">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex -space-x-2">
          {members.data?.slice(0, 3).map((m) => (
            <Avatar key={m.user_id} className="size-7 border-2 border-background">
              <AvatarImage src={m.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="text-[10px]">{initials(m.full_name)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {members.data?.map((m) => (m.user_id === userId ? "You" : m.full_name || "Member")).join(", ")}
        </p>
        <Button size="sm" variant="ghost" onClick={() => setInfoOpen(true)} aria-label="Hub info">
          <Info className="size-4" /> <span className="hidden sm:inline">Hub info</span>
        </Button>
      </div>

      {latestPinned ? (
        <button
          type="button"
          onClick={() => jumpTo(latestPinned.id)}
          className="flex items-center gap-2 border-b border-border bg-primary/5 px-3 py-2 text-left text-sm"
        >
          <Pin className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">{latestPinned.message || latestPinned.attachment_name}</span>
        </button>
      ) : null}

      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto bg-muted/20 px-2 py-3 sm:px-4">
        {messages.isError ? (
          <div className="py-12 text-center text-sm text-destructive">
            Couldn't load messages.{" "}
            <button type="button" className="underline" onClick={() => void messages.refetch()}>
              Retry
            </button>
          </div>
        ) : list.length ? (
          list.map((message, i) => {
            const prev = list[i - 1];
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(message.created_at);
            const grouped = !newDay && prev?.user_id === message.user_id;
            return (
              <div key={message.id}>
                {newDay ? (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-md bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">
                      {dayLabel(message.created_at)}
                    </span>
                  </div>
                ) : null}
                <Bubble
                  message={message}
                  author={byUser.get(message.user_id)}
                  mine={message.user_id === userId}
                  grouped={grouped}
                  highlight={highlight === message.id}
                  replied={message.reply_to_id ? byId.get(message.reply_to_id) : undefined}
                  replyAuthor={message.reply_to_id ? byUser.get(byId.get(message.reply_to_id)?.user_id ?? "")?.full_name : undefined}
                  reactions={reactionsBy.get(message.id) ?? []}
                  userId={userId}
                  isAdmin={isAdmin}
                  onReply={() => {
                    setEditing(null);
                    setReplyTo(message);
                    inputRef.current?.focus();
                  }}
                  onEdit={() => {
                    setReplyTo(null);
                    setEditing(message);
                    setText(message.message);
                    inputRef.current?.focus();
                  }}
                  onReact={(e) => void react(message, e)}
                  onCopy={() => void copy(message)}
                  onDelete={() => void remove(message)}
                  onPin={() => void togglePin(message)}
                  onJump={jumpTo}
                />
              </div>
            );
          })
        ) : messages.isLoading ? null : (
          <p className="py-12 text-center text-muted-foreground">No messages yet — say hello to your hub.</p>
        )}

        {pending.map((item) => (
          <div key={item.id} className="ml-auto w-64 max-w-[85%] rounded-lg bg-primary/10 p-3 text-sm">
            <p className="truncate font-medium">{item.kind === "voice" ? "Voice note" : item.name}</p>
            {item.error ? (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-destructive">{item.error}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void runUpload(item)}>
                    <RotateCw className="size-3.5" /> Retry
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPending((p) => p.filter((x) => x.id !== item.id))}>
                    Discard
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Progress value={Math.round(item.progress * 100)} className="mt-2 h-1.5" />
                <p className="mt-1 text-xs text-muted-foreground">Uploading… {Math.round(item.progress * 100)}%</p>
              </>
            )}
          </div>
        ))}
      </div>

      <Composer
        text={text}
        setText={setText}
        inputRef={inputRef}
        fileRef={fileRef}
        replyTo={replyTo}
        replyName={replyTo ? (replyTo.user_id === userId ? "You" : byUser.get(replyTo.user_id)?.full_name || "Member") : ""}
        editing={editing}
        onCancel={() => {
          setReplyTo(null);
          if (editing) setText("");
          setEditing(null);
        }}
        onSend={send}
        onFiles={onFiles}
        onVoice={(blob, durationMs, type) =>
          queue({
            file: blob,
            name: `voice-note.${type.includes("mp4") ? "m4a" : "webm"}`,
            type,
            kind: "voice",
            durationMs,
            caption: "",
            replyTo: replyTo?.id ?? null,
          })
        }
      />

      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Hub info</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 px-4 pb-4">
            <HubPanel podId={podId} userId={userId} isAdmin={isAdmin} messages={list} onJump={jumpTo} />
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function Bubble(props: {
  message: ChatMessage;
  author: { full_name: string; avatar_url: string | null } | undefined;
  mine: boolean;
  grouped: boolean;
  highlight: boolean;
  replied: ChatMessage | undefined;
  replyAuthor: string | undefined;
  reactions: ChatReaction[];
  userId: string | undefined;
  isAdmin: boolean;
  onReply: () => void;
  onEdit: () => void;
  onReact: (emoji: string) => void;
  onCopy: () => void;
  onDelete: () => void;
  onPin: () => void;
  onJump: (id: string) => void;
}) {
  const { message: m, mine, author } = props;
  const deleted = Boolean(m.deleted_at);
  const counts = new Map<string, { n: number; me: boolean }>();
  for (const r of props.reactions) {
    const c = counts.get(r.emoji) ?? { n: 0, me: false };
    counts.set(r.emoji, { n: c.n + 1, me: c.me || r.user_id === props.userId });
  }
  const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      id={`msg-${m.id}`}
      className={`group flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${props.grouped ? "mt-0.5" : "mt-3"}`}
    >
      {!mine ? (
        props.grouped ? (
          <span className="w-8 shrink-0" />
        ) : (
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={author?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="text-xs">{initials(author?.full_name)}</AvatarFallback>
          </Avatar>
        )
      ) : null}
      <div className={`flex max-w-[82%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
        <div
          className={`relative rounded-2xl px-3 py-2 text-sm shadow-sm transition ${
            mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card text-card-foreground"
          } ${props.highlight ? "ring-2 ring-ring" : ""}`}
        >
          {!mine && !props.grouped ? (
            <p className="mb-0.5 text-xs font-semibold text-primary">{author?.full_name || "Member"}</p>
          ) : null}

          {deleted ? (
            <p className="italic opacity-70">This message was deleted</p>
          ) : (
            <>
              {props.replied ? (
                <button
                  type="button"
                  onClick={() => props.onJump(props.replied!.id)}
                  className={`mb-1 block w-full rounded-md border-l-4 px-2 py-1 text-left text-xs ${
                    mine ? "border-primary-foreground/60 bg-primary-foreground/15" : "border-primary bg-muted"
                  }`}
                >
                  <span className="font-semibold">{props.replyAuthor || "Member"}</span>
                  <span className="line-clamp-2 opacity-80">
                    {props.replied.deleted_at
                      ? "Deleted message"
                      : props.replied.message || props.replied.attachment_name || "Attachment"}
                  </span>
                </button>
              ) : null}
              {m.kind === "image" ? <ImageAttachment message={m} /> : null}
              {m.kind === "file" ? <DocAttachment message={m} /> : null}
              {m.kind === "voice" || m.kind === "audio" ? <AudioAttachment message={m} mine={mine} /> : null}
              {m.message ? <p className="whitespace-pre-wrap break-words pr-12">{m.message}</p> : null}
            </>
          )}
          <span className="float-right -mb-1 ml-2 mt-1 flex items-center gap-1 text-[10px] opacity-70">
            {m.pinned_at && !deleted ? <Pin className="size-3" /> : null}
            {m.edited_at && !deleted ? "edited · " : ""}
            {time}
          </span>

          {!deleted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Message options"
                  className={`absolute right-1 top-1 rounded-full p-0.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 ${
                    mine ? "bg-primary" : "bg-card"
                  }`}
                >
                  <ChevronDown className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={mine ? "end" : "start"}>
                <div className="flex gap-1 px-1 py-1">
                  {QUICK_REACTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="rounded-full p-1 text-lg transition hover:scale-125 hover:bg-muted"
                      onClick={() => props.onReact(e)}
                      aria-label={`React ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={props.onReply}>
                  <CornerUpLeft className="size-4" /> Reply
                </DropdownMenuItem>
                <DropdownMenuItem onClick={props.onCopy}>
                  <Copy className="size-4" /> Copy
                </DropdownMenuItem>
                {mine && m.kind === "text" ? (
                  <DropdownMenuItem onClick={props.onEdit}>
                    <Pencil className="size-4" /> Edit
                  </DropdownMenuItem>
                ) : null}
                {props.isAdmin ? (
                  <DropdownMenuItem onClick={props.onPin}>
                    {m.pinned_at ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                    {m.pinned_at ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                ) : null}
                {mine || props.isAdmin ? (
                  <DropdownMenuItem className="text-destructive" onClick={props.onDelete}>
                    <Trash2 className="size-4" /> Delete for everyone
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {counts.size ? (
          <div className="-mt-1.5 flex flex-wrap gap-1 px-1">
            {[...counts].map(([emoji, c]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => props.onReact(emoji)}
                className={`rounded-full border px-1.5 text-xs shadow-sm ${
                  c.me ? "border-primary bg-primary/10" : "border-border bg-background"
                }`}
              >
                {emoji} {c.n > 1 ? c.n : ""}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Composer(props: {
  text: string;
  setText: (v: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  replyTo: ChatMessage | null;
  replyName: string;
  editing: ChatMessage | null;
  onCancel: () => void;
  onSend: (e?: React.FormEvent) => void;
  onFiles: (files: FileList | null) => void;
  onVoice: (blob: Blob, durationMs: number, type: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; start: number; cancel: boolean; stream: MediaStream } | null>(null);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed(Date.now() - (recRef.current?.start ?? Date.now())), 250);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => () => recRef.current?.stream.getTracks().forEach((t) => t.stop()), []);

  async function startVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
      const state = { rec, chunks: [] as Blob[], start: Date.now(), cancel: false, stream };
      rec.ondataavailable = (e) => e.data.size && state.chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const duration = Date.now() - state.start;
        if (state.cancel || duration < 700) return;
        const type = rec.mimeType || "audio/webm";
        props.onVoice(new Blob(state.chunks, { type }), duration, type);
      };
      rec.start(1000);
      recRef.current = state;
      setElapsed(0);
      setRecording(true);
    } catch {
      toast.error("Microphone access was blocked. Allow it in your browser settings.");
    }
  }

  function stopVoice(cancel: boolean) {
    const r = recRef.current;
    if (!r) return;
    r.cancel = cancel;
    if (r.rec.state !== "inactive") r.rec.stop();
    recRef.current = null;
    setRecording(false);
  }

  return (
    <div className="border-t border-border bg-background">
      {props.replyTo || props.editing ? (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
          <div className="min-w-0 flex-1 border-l-4 border-primary pl-2">
            <p className="font-semibold text-primary">{props.editing ? "Editing message" : `Replying to ${props.replyName}`}</p>
            <p className="truncate text-muted-foreground">
              {(props.editing ?? props.replyTo)?.message || (props.editing ?? props.replyTo)?.attachment_name || "Attachment"}
            </p>
          </div>
          <Button size="icon" variant="ghost" className="size-7" onClick={props.onCancel} aria-label="Cancel">
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      {recording ? (
        <div className="flex items-center gap-3 p-3">
          <Button size="icon" variant="ghost" onClick={() => stopVoice(true)} aria-label="Cancel voice note">
            <Trash2 className="size-4" />
          </Button>
          <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
          <span className="flex-1 font-mono text-sm">{formatDuration(elapsed)}</span>
          <Button size="icon" className="rounded-full" onClick={() => stopVoice(false)} aria-label="Send voice note">
            <Square className="size-4" />
          </Button>
        </div>
      ) : (
        <form onSubmit={props.onSend} className="flex items-end gap-1 p-2 sm:gap-2 sm:p-3">
          <EmojiPicker
            onPick={(e) => {
              props.setText(props.text + e);
              props.inputRef.current?.focus();
            }}
          >
            <Button type="button" size="icon" variant="ghost" aria-label="Emoji">
              <Smile className="size-5" />
            </Button>
          </EmojiPicker>
          {!props.editing ? (
            <Button type="button" size="icon" variant="ghost" aria-label="Attach file" onClick={() => props.fileRef.current?.click()}>
              <Paperclip className="size-5" />
            </Button>
          ) : null}
          <input
            ref={props.fileRef}
            type="file"
            multiple
            accept={CHAT_ACCEPT}
            className="hidden"
            onChange={(e) => props.onFiles(e.target.files)}
            aria-label="Upload file"
          />
          <Textarea
            ref={props.inputRef}
            rows={1}
            value={props.text}
            onChange={(e) => props.setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                props.onSend();
              }
              if (e.key === "Escape") props.onCancel();
            }}
            placeholder="Type a message"
            aria-label="Message"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl"
          />
          {props.text.trim() ? (
            <Button type="submit" size="icon" className="shrink-0 rounded-full" aria-label={props.editing ? "Save edit" : "Send"}>
              {props.editing ? <Check className="size-4" /> : <Send className="size-4" />}
            </Button>
          ) : (
            <Button type="button" size="icon" className="shrink-0 rounded-full" aria-label="Record voice note" onClick={() => void startVoice()}>
              <Mic className="size-4" />
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
