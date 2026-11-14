import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, FileText, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes } from "@/lib/audio";
import { CHAT_BUCKET, docLabel, formatDuration, type ChatMessage } from "@/lib/chat";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EMOJIS =
  "😀 😁 😂 🤣 😊 😍 🥰 😘 😎 🤓 🤔 🤨 😐 😴 😮 😢 😭 😡 🥳 🤯 😅 🙃 😉 😇 👍 👎 👏 🙌 🙏 💪 👀 🤝 ✌️ 👌 ❤️ 💔 🔥 ✨ 🎉 💯 ✅ ❌ ⭐ 📚 📝 📖 🎓 🧠 💡 ⏰ 📌 📎 🖊️ 💻 📊 🧪 🔬 ➕ ❓".split(
    " ",
  );

export function EmojiPicker({
  onPick,
  children,
}: {
  onPick: (emoji: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start" side="top">
        <div className="grid grid-cols-8 gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded-md p-1 text-xl transition hover:bg-muted"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Short-lived private link to a hub file; only members can create one. */
export function useSignedUrl(path: string | null, download?: string) {
  return useQuery({
    queryKey: ["chat-file", path, download ?? ""],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(CHAT_BUCKET)
        .createSignedUrl(path!, 120, download ? { download } : undefined);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function ImageAttachment({ message }: { message: ChatMessage }) {
  const url = useSignedUrl(message.attachment_path);
  const dl = useSignedUrl(message.attachment_path, message.attachment_name ?? "image");
  const [open, setOpen] = useState(false);
  if (url.isError) return <p className="text-xs text-destructive">Image unavailable</p>;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block overflow-hidden rounded-md">
        {url.data ? (
          <img
            src={url.data}
            alt={message.attachment_name ?? "Shared image"}
            className="max-h-72 w-full max-w-xs object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-48 w-64 animate-pulse bg-muted" />
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="truncate pr-8">{message.attachment_name}</DialogTitle>
          {url.data ? <img src={url.data} alt="" className="max-h-[70vh] w-full object-contain" /> : null}
          {dl.data ? (
            <Button asChild variant="outline">
              <a href={dl.data}>
                <Download className="size-4" /> Download
              </a>
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DocAttachment({ message }: { message: ChatMessage }) {
  const name = message.attachment_name ?? "Document";
  const view = useSignedUrl(message.attachment_path);
  const dl = useSignedUrl(message.attachment_path, name);
  const isPdf = docLabel(name) === "PDF";
  return (
    <div className="flex w-64 max-w-full items-center gap-3 rounded-md bg-background/60 p-2 text-foreground">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
        <FileText className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          {docLabel(name)}
          {message.attachment_size ? ` · ${formatBytes(message.attachment_size)}` : ""}
        </p>
      </div>
      {isPdf && view.data ? (
        <a href={view.data} target="_blank" rel="noreferrer" aria-label="Open" className="rounded p-1 hover:bg-muted">
          <ExternalLink className="size-4" />
        </a>
      ) : null}
      {dl.data ? (
        <a href={dl.data} aria-label={`Download ${name}`} className="rounded p-1 hover:bg-muted">
          <Download className="size-4" />
        </a>
      ) : null}
    </div>
  );
}

export function AudioAttachment({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const url = useSignedUrl(message.attachment_path);
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState((message.duration_ms ?? 0) / 1000);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setPos(a.currentTime);
    const onMeta = () => Number.isFinite(a.duration) && setDur(a.duration);
    const onEnd = () => {
      setPlaying(false);
      setPos(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [url.data]);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (playing) a.pause();
    else void a.play().catch(() => setPlaying(false));
    setPlaying(!playing);
  }

  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;
  return (
    <div className="flex w-60 max-w-full items-center gap-3">
      <Button
        type="button"
        size="icon"
        variant={mine ? "secondary" : "default"}
        className="size-9 shrink-0 rounded-full"
        onClick={toggle}
        disabled={!url.data}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <div className="flex-1">
        <input
          type="range"
          min={0}
          max={dur || 1}
          step={0.1}
          value={pos}
          aria-label="Seek"
          onChange={(e) => {
            if (ref.current) ref.current.currentTime = Number(e.target.value);
          }}
          className="w-full accent-current"
          style={{ background: `linear-gradient(to right, currentColor ${pct}%, transparent ${pct}%)` }}
        />
        <p className="text-[11px] opacity-80">
          {message.kind === "voice" ? "Voice note · " : `${message.attachment_name ?? "Audio"} · `}
          {formatDuration((playing || pos ? pos : dur) * 1000)}
        </p>
      </div>
      {url.data ? <audio ref={ref} src={url.data} preload="metadata" /> : null}
    </div>
  );
}
