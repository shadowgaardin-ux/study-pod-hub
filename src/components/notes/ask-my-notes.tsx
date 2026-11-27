import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircleQuestion, Quote, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askMyNotes, type AskNotesSource } from "@/lib/ai.functions";

type Scope = { noteId: string } | { course: string | null; semester: string | null };

export function AskMyNotes({ scope, label }: { scope: Scope; label: string }) {
  const ask = useServerFn(askMyNotes);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ answer: string; sources: AskNotesSource[] } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await ask({ data: { question: question.trim(), ...scope } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/60 p-3">
      <form onSubmit={submit} className="flex items-center gap-2">
        <MessageCircleQuestion className="size-4 shrink-0 text-ai" />
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={label}
          aria-label={label}
          maxLength={1000}
          className="h-9"
        />
        <Button type="submit" size="icon" className="size-9 shrink-0" disabled={busy || question.trim().length < 2} aria-label="Ask">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? (
        <div className="space-y-2 text-sm">
          <p className="whitespace-pre-wrap">{result.answer}</p>
          {result.sources.length ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">From your notes</p>
              {result.sources.map((s) => (
                <blockquote key={s.ref} className="rounded-lg border-l-2 border-primary bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Quote className="size-3" /> {s.noteTitle}
                  </span>
                  <span className="mt-1 block">“{s.excerpt}{s.excerpt.length >= 320 ? "…" : ""}”</span>
                </blockquote>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
