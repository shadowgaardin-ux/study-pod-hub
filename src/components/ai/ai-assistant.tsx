import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { studyAction } from "@/lib/ai.functions";
import { HelpCircle, KeyRound, List, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface SourceNote {
  id: string;
  title: string;
  transcript: string | null;
  summary: string | null;
}

type Action = "bullets" | "terms" | "quiz";

const ACTIONS: { key: Action; label: string; icon: typeof List }[] = [
  { key: "bullets", label: "Generate bullet points", icon: List },
  { key: "terms", label: "Extract key terms", icon: KeyRound },
  { key: "quiz", label: "Create quiz questions", icon: HelpCircle },
];

export function AiAssistant({ inline = false, compact = false }: { inline?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [noteId, setNoteId] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const runAi = useServerFn(studyAction);
  const hash = useRouterState({ select: (state) => state.location.hash });
  useEffect(() => {
    if (inline && hash === "assistant") setOpen(true);
  }, [hash, inline]);

  const notes = useQuery({
    queryKey: ["ai-source-notes"],
    enabled: open,
    queryFn: async (): Promise<SourceNote[]> => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, transcript, summary")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as SourceNote[];
    },
  });

  const note = notes.data?.find((n) => n.id === noteId);
  const source = [note?.summary, note?.transcript].filter(Boolean).join("\n\n");

  async function run(key: Action) {
    setAction(key);
    setResults([]);
    if (!source) return;
    setBusy(true);
    try {
      const res = await runAi({ data: { action: key, text: source.slice(0, 60000) } });
      setResults(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {compact ? <Button variant="ghost" onClick={() => setOpen(true)} className="gap-2 text-sm text-muted-foreground" aria-label="Open AI assistant"><Sparkles className="size-4 text-ai" />AI Assistant</Button> : inline ? (
        <section className="space-y-5 border-y border-brand-purple/20 bg-accent/30 px-5 py-6">
          <span className="grid size-11 place-items-center rounded-lg border border-brand-purple/25 bg-brand-purple/10 text-ai"><Sparkles className="size-5" /></span>
          <h2 className="text-lg font-semibold">
            AI Assistant
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Your notes. A fresh perspective.</p>
          <Button onClick={() => setOpen(true)} className="w-full justify-between" aria-label="Open AI assistant">
            Study with AI <Sparkles className="size-4" />
          </Button>
        </section>
      ) : <Button
        onClick={() => setOpen(true)}
        size="icon"
        aria-label="Open AI assistant"
        className="fixed right-5 bottom-5 z-40 size-14 rounded-full shadow-[var(--shadow-lift)] transition-transform hover:scale-105"
      >
        <Sparkles className="size-6" />
      </Button>}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-card bg-gradient-surface sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="display flex items-center gap-3 text-xl">
              <span className="icon-chip size-10 shadow-glow logo-glow"><Sparkles className="size-5" /></span>
              <span className="text-gradient">AI Assistant</span>
            </SheetTitle>
            <SheetDescription>
              Pick a recording or note, then run a quick action on it.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-6 pb-8">
            {notes.isLoading ? (
              <Skeleton className="h-10 rounded-md" />
            ) : (
              <Select value={noteId} onValueChange={(v) => { setNoteId(v); setResults([]); setAction(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a recording or note" />
                </SelectTrigger>
                <SelectContent>
                  {(notes.data ?? []).map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="grid gap-2">
              {ACTIONS.map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={action === key ? "default" : "outline"}
                  className="h-11 justify-start gap-3 rounded-xl"
                  disabled={!note || busy}
                  onClick={() => void run(key)}
                >
                  {busy && action === key ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />} {label}
                </Button>
              ))}
            </div>

            {note && source ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">Transcript</p>
                <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-secondary/40 p-3 text-sm text-muted-foreground">
                  {source}
                </div>
              </div>
            ) : null}

            {note && !source && (
              <p className="rounded-xl border border-brand-amber/30 bg-brand-amber/10 p-3 text-sm text-muted-foreground">
                This note has no transcript yet — add one, or transcribe the audio, to use the
                assistant.
              </p>
            )}

            {busy ? (
              <div className="space-y-2 rounded-xl border border-primary/20 p-4" aria-label="AI is working">
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : null}

            {results.length > 0 && (
              <ul className="glow-ring rise-in space-y-2.5 rounded-xl bg-card bg-gradient-surface p-4 text-sm shadow-glow">
                {results.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gradient-primary" />
                    <span className="leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
