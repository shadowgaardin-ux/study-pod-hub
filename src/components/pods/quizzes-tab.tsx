import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function QuizzesTab() {
  // TODO: generate quizzes from pod notes with an AI server function.
  return (
    <Card>
      <CardHeader>
        <CardTitle className="display flex items-center gap-2 text-lg">
          <Sparkles className="size-5 text-primary" /> AI practice quizzes
        </CardTitle>
        <CardDescription>
          Turn this pod's notes into multiple-choice practice questions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Quiz generation is not connected yet. Once enabled, we'll read the pod's notes and
          transcripts and build a graded practice set.
        </p>
        <Button onClick={() => toast.info("AI quiz generation is coming soon.")}>
          Generate quiz
        </Button>
      </CardContent>
    </Card>
  );
}
