import { useQuery } from "@tanstack/react-query";
import { HelpCircle, KeyRound, List, Sparkles } from "lucide-react";
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

const STOP_WORDS = new Set(
  "the a an and or of to in for on with is are was were be been that this these those it its as by from at".split(
    " ",
  ),
);

function sentencesOf(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

// TODO: swap this local heuristic for a server function backed by the AI gateway.
function runAction(action: Action, text: string): string[] {
  const sentences = sentencesOf(text);
  if (action === "bullets") {
    return sentences.slice(0, 6).map((s) => (s.length > 160 ? `${s.slice(0, 157)}…` : s));
  }
  if (action === "terms") {
    const counts = new Map<string, number>();
    for (const word of text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
      if (STOP_WORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, n]) => `${word} — mentioned ${n}×`);
  }
  return sentences
    .slice(0, 5)
    .map((s, i) => `Q${i + 1}. ${s.replace(/\.$/, "")}? — review this point in your notes.`);
}

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [noteId, setNoteId] = useState("");
  const [action, setAction] = useState<Action | null>(null);

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
  const results = action && source ? runAction(action, source) : [];

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
              <Select value={noteId} onValueChange={setNoteId}>
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
                  disabled={!note}
                  onClick={() => setAction(key)}
                >
                  <Icon className="size-4" /> {label}
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
