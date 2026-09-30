import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { studyAction } from "@/lib/ai.functions";
import { HelpCircle, KeyRound, List, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

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

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [noteId, setNoteId] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const runAi = useServerFn(studyAction);

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
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        aria-label="Open AI assistant"
        className="fixed right-5 bottom-5 z-40 size-14 rounded-full shadow-[var(--shadow-lift)] transition-transform hover:scale-105"
      >
        <Sparkles className="size-6" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="display flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> AI assistant
            </SheetTitle>
            <SheetDescription>
              Pick a recording or note, then run a quick action on it.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-8">
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
                  className="justify-start gap-2"
                  disabled={!note || busy}
                  onClick={() => void run(key)}
                >
                  {busy && action === key ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />} {label}
                </Button>
              ))}
            </div>

            {note && !source && (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                This note has no transcript yet — add one, or transcribe the audio, to use the
                assistant.
              </p>
            )}

            {results.length > 0 && (
              <ul className="space-y-2 rounded-lg border border-border p-4 text-sm">
                {results.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{line}</span>
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
