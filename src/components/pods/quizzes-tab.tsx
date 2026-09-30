import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generatePodQuiz, type QuizQuestion } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export function QuizzesTab({ podId }: { podId: string }) {
  const run = useServerFn(generatePodQuiz);
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [picks, setPicks] = useState<Record<number, number>>({});

  async function generate() {
    setBusy(true);
    try {
      const res = await run({ data: { podId, count: 5 } });
      setQuestions(res.questions);
      setPicks({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create a quiz");
    } finally {
      setBusy(false);
    }
  }

  const answered = Object.keys(picks).length;
  const score = questions.filter((q, i) => picks[i] === q.answer).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="display flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-primary" /> AI practice quizzes
          </CardTitle>
          <CardDescription>Turn this pod's notes and transcripts into multiple-choice practice.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void generate()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : questions.length ? <RotateCcw className="size-4" /> : <Sparkles className="size-4" />}
            {busy ? "Creating quiz…" : questions.length ? "New quiz" : "Generate quiz"}
          </Button>
          {questions.length > 0 && (
            <span className="text-sm text-muted-foreground">
              Score: {score}/{questions.length} ({answered} answered)
            </span>
          )}
        </CardContent>
      </Card>

      {questions.map((q, i) => {
        const pick = picks[i];
        const done = pick !== undefined;
        return (
          <Card key={`${i}-${q.question}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {i + 1}. {q.question}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {q.options.map((opt, j) => (
                <Button
                  key={j}
                  variant="outline"
                  disabled={done}
                  onClick={() => setPicks((p) => ({ ...p, [i]: j }))}
                  className={cn(
                    "h-auto justify-start whitespace-normal py-2 text-left disabled:opacity-100",
                    done && j === q.answer && "border-primary bg-primary/10",
                    done && j === pick && j !== q.answer && "border-destructive bg-destructive/10",
                  )}
                >
                  {done && j === q.answer ? <Check className="size-4 text-primary" /> : done && j === pick ? <X className="size-4 text-destructive" /> : null}
                  {opt}
                </Button>
              ))}
              {done && q.explanation && <p className="pt-1 text-sm text-muted-foreground">{q.explanation}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
