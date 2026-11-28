import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Layers, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { generateStudyMaterial, loadStudyMaterial } from "@/lib/study-material.functions";
import { reviewDueAt, type StudyScope, type StudyRating } from "@/lib/study-material";
import { cn } from "@/lib/utils";

export function StudyPractice({ scope, title }: { scope: StudyScope; title: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"flashcards" | "quiz">("flashcards");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const load = useServerFn(loadStudyMaterial);
  const generate = useServerFn(generateStudyMaterial);
  const cache = useQueryClient();
  const key = ["study-material", user?.id, scope];
  const material = useQuery({ queryKey: key, enabled: open, queryFn: () => load({ data: scope }) });
  const quiz = material.data?.quiz;
  async function refresh() { await cache.invalidateQueries({ queryKey: key }); }
  async function create() {
    setBusy(true);
    try { await generate({ data: { scope, kind: mode } }); setFlipped({}); await refresh(); await cache.invalidateQueries({ queryKey: ["personal-cards"] }); toast.success(mode === "quiz" ? "Quiz saved" : "Flashcards saved"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't generate study material."); } finally { setBusy(false); }
  }
  async function rateCard(id: string, rating: StudyRating) {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("flashcard_reviews").upsert({ card_id: id, user_id: user.id, rating, due_at: reviewDueAt(rating) }, { onConflict: "card_id,user_id" });
      if (error) throw error;
      setFlipped((prev) => ({ ...prev, [id]: false })); await refresh();
    } catch { toast.error("Couldn't save your rating."); } finally { setSaving(false); }
  }
  async function removeCard(id: string) {
    setSaving(true);
    try { const { error } = await supabase.from("flashcards").delete().eq("id", id); if (error) throw error; await refresh(); } catch { toast.error("Couldn't delete this card."); } finally { setSaving(false); }
  }
  async function updateQuiz(index: number, pick?: number, rating?: StudyRating) {
    if (!quiz) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("practice_quizzes").update({ picks: pick !== undefined ? { ...quiz.picks, [index]: pick } : quiz.picks, ratings: rating ? { ...quiz.ratings, [index]: rating } : quiz.ratings }).eq("id", quiz.id);
      if (error) throw error; await refresh();
    } catch { toast.error("Couldn't save your quiz progress."); } finally { setSaving(false); }
  }
  const ratings = (index: number, value: string | undefined, onRate: (r: StudyRating) => void) => <div className="flex flex-wrap gap-2" aria-label={`Rate question ${index + 1}`}>{(["hard", "medium", "easy"] as const).map((r) => <Button size="sm" variant={value === r ? "default" : "outline"} key={r} disabled={saving} className="capitalize" onClick={() => onRate(r)}>{r}</Button>)}</div>;
  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Layers className="size-4" /> Flashcards & quizzes</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle className="pr-5 break-words">Study practice · {title}</DialogTitle><DialogDescription>{"noteId" in scope ? "From this lecture's saved notes and summary." : "From the saved lecture notes and summaries in this course."}</DialogDescription></DialogHeader>
      <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant={mode === "flashcards" ? "default" : "outline"} onClick={() => setMode("flashcards")}>Flashcards</Button><Button size="sm" variant={mode === "quiz" ? "default" : "outline"} onClick={() => setMode("quiz")}>Quiz</Button><Button size="sm" className="ml-auto" disabled={busy || material.isLoading} onClick={() => void create()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{busy ? "Generating…" : "Generate new"}</Button></div>
      {material.isLoading ? <Loader2 className="mx-auto size-6 animate-spin text-primary" /> : material.isError ? <div className="space-y-2"><p className="text-sm text-destructive">Couldn't load your study material.</p><Button variant="outline" onClick={() => void refresh()}><RotateCcw className="size-4" /> Retry</Button></div> : mode === "flashcards" ? <div className="space-y-3">
        {!material.data?.cards.length ? <p className="py-8 text-center text-sm text-muted-foreground">No flashcards for this {"noteId" in scope ? "lecture" : "course"} yet.</p> : null}
        {material.data?.cards.map((c, index) => { const review = material.data.reviews.find((r) => r.card_id === c.id); return <div key={c.id} className="space-y-3 border-b border-border py-3">
          <div className="flex items-start gap-2"><p className="flex-1 whitespace-pre-wrap text-sm font-medium">{c.front}</p><Button size="icon" variant="ghost" aria-label="Delete flashcard" disabled={saving} onClick={() => void removeCard(c.id)}><Trash2 className="size-4" /></Button></div>
          <Button size="sm" variant="ghost" onClick={() => setFlipped((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}><ChevronDown className="size-4" />{flipped[c.id] ? "Hide answer" : "Show answer"}</Button>
          {flipped[c.id] ? <><p className="whitespace-pre-wrap text-sm text-muted-foreground">{c.back}</p>{ratings(index, review?.rating, (r) => void rateCard(c.id, r))}</> : review ? <p className="text-xs text-muted-foreground">{review.rating} · Review {new Date(review.due_at).toLocaleString()}</p> : null}
        </div>; })}
      </div> : <div className="space-y-4">
        {quiz ? <p className="text-xs text-muted-foreground">Score: {quiz.questions.filter((q, i) => quiz.picks[i] === q.answer).length}/{quiz.questions.length}</p> : <p className="py-8 text-center text-sm text-muted-foreground">No quiz for this {"noteId" in scope ? "lecture" : "course"} yet.</p>}
        {quiz?.questions.map((q, i) => { const pick = quiz.picks[i]; const done = pick !== undefined; return <div key={i} className="space-y-2 border-b border-border pb-4"><p className="text-xs text-muted-foreground">{q.type === "true_false" ? "True / false" : "Multiple choice"}</p><h3 className="text-sm font-medium">{i + 1}. {q.question}</h3>{q.options.map((option, j) => <Button key={j} variant="outline" disabled={done || saving} className={cn("h-auto w-full justify-start whitespace-normal text-left disabled:opacity-100", done && j === q.answer && "border-primary bg-primary/10", done && pick === j && j !== q.answer && "border-destructive bg-destructive/10")} onClick={() => void updateQuiz(i, j)}>{done && j === q.answer ? <Check className="size-4 shrink-0" /> : null}{option}</Button>)}{done ? <><p className="text-sm text-muted-foreground">{q.explanation}</p>{ratings(i, quiz.ratings[i], (r) => void updateQuiz(i, undefined, r))}</> : null}</div>; })}
      </div>}
    </DialogContent></Dialog>
  </>;
}