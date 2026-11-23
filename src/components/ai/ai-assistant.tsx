import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { studyAction } from "@/lib/ai.functions";
import { ArrowUp, HelpCircle, KeyRound, List, Loader2, Sparkles } from "lucide-react";
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

const ACTIONS: { key: Action; label: string; short: string; icon: typeof List }[] = [
  { key: "bullets", label: "Generate bullet points", short: "Bullet points", icon: List },
  { key: "terms", label: "Extract key terms", short: "Key terms", icon: KeyRound },
  { key: "quiz", label: "Create quiz questions", short: "Quiz questions", icon: HelpCircle },
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
        <SheetContent className="ai-stage flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <div className="flex justify-center px-6 pt-5">
            <span className="glass inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5">
              <span className="relative size-5 overflow-hidden rounded-full bg-gradient-ai" aria-hidden="true" />
              <span className="text-left leading-tight">
                <span className="block text-xs font-semibold">Study AI</span>
                <span className="block text-[10px] text-muted-foreground">AI Assistant</span>
              </span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className={`ai-orb mt-6 ${results.length || busy ? "is-small" : ""} ${busy ? "is-thinking" : ""}`} aria-hidden="true">
              <span className="ai-orb-layer ai-orb-glow" />
              <span className="ai-orb-layer ai-orb-fibres" />
              <span className="ai-orb-layer ai-orb-fibres alt" />
              <span className="ai-orb-core" />
            </div>

            <SheetHeader className="mt-5 items-center space-y-1 text-center sm:text-center">
              <p className="text-sm text-muted-foreground">Hi, I'm your study assistant!</p>
              <SheetTitle className="display text-2xl leading-tight">
                {busy ? "Thinking it through…" : "How can I help you today?"}
              </SheetTitle>
              <SheetDescription className="max-w-xs">
                {note ? <>Working with <span className="font-medium text-foreground">{note.title}</span></> : "Choose a recording or note below, then pick an action."}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              {note && !source && (
                <p className="rounded-2xl border border-brand-amber/30 bg-brand-amber/10 p-3 text-sm text-muted-foreground">
                  This note has no transcript yet — add one, or transcribe the audio, to use the assistant.
                </p>
              )}

              {busy ? (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-card/60 p-4" aria-label="AI is working">
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : null}

              {results.length > 0 && (
                <ul className="glow-ring rise-in space-y-2.5 rounded-2xl bg-card bg-gradient-surface p-4 text-sm shadow-glow">
                  {results.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gradient-ai" />
                      <span className="leading-relaxed">{line}</span>
                    </li>
                  ))}
                </ul>
              )}

              {note && source ? (
                <details className="group rounded-2xl border border-border/60 bg-card/40 px-4 py-3 text-sm">
                  <summary className="cursor-pointer list-none font-medium text-muted-foreground transition-colors hover:text-foreground">
                    View transcript
                  </summary>
                  <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap text-muted-foreground">{source}</div>
                </details>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 border-t border-border/40 px-4 pt-3 pb-5">
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="AI actions">
              {ACTIONS.map(({ key, label, short, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  data-active={action === key}
                  disabled={!note || busy}
                  onClick={() => void run(key)}
                  aria-label={label}
                  className="ai-chip inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy && action === key ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5 text-brand-pink" />}
                  {short}
                </button>
              ))}
            </div>

            <div className="glass flex items-center gap-2 rounded-full border border-border/70 p-1.5 pl-2">
              {notes.isLoading ? (
                <Skeleton className="h-9 flex-1 rounded-full" />
              ) : (
                <Select value={noteId} onValueChange={(v) => { setNoteId(v); setResults([]); setAction(null); }}>
                  <SelectTrigger className="h-9 min-w-0 flex-1 rounded-full border-0 bg-transparent shadow-none focus:ring-0" aria-label="Recording or note">
                    <SelectValue placeholder="Choose a recording or note…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(notes.data ?? []).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No notes yet — record a lecture first.</div>
                    ) : (notes.data ?? []).map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <button
                type="button"
                onClick={() => void run(action ?? "bullets")}
                disabled={!source || busy}
                aria-label={`Run ${ACTIONS.find((a) => a.key === (action ?? "bullets"))?.label.toLowerCase()}`}
                className="ai-send grid size-10 shrink-0 place-items-center rounded-full bg-gradient-ai text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
