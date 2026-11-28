import { z } from "zod";

export const studyScopeSchema = z.union([
  z.object({ noteId: z.string().uuid() }).strict(),
  z.object({ semester: z.string().max(120).nullable(), course: z.string().max(120).nullable() }).strict(),
]);
export type StudyScope = z.infer<typeof studyScopeSchema>;
export const ratingSchema = z.enum(["hard", "medium", "easy"]);
export type StudyRating = z.infer<typeof ratingSchema>;
export const cardSchema = z.object({ front: z.string().trim().min(1).max(1500), back: z.string().trim().min(1).max(3000) });
export const questionSchema = z.object({
  type: z.enum(["multiple_choice", "true_false"]),
  question: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(1000)),
  answer: z.number().int().nonnegative(),
  explanation: z.string().max(3000),
}).superRefine((q, ctx) => {
  if (q.options.length !== (q.type === "true_false" ? 2 : 4) || q.answer >= q.options.length)
    ctx.addIssue({ code: "custom", message: "Invalid question options or answer" });
  if (q.type === "true_false" && (q.options[0] !== "True" || q.options[1] !== "False"))
    ctx.addIssue({ code: "custom", message: "True/false options must be True and False" });
});
export type PracticeQuestion = z.infer<typeof questionSchema>;
export const quizSchema = z.object({ questions: z.array(questionSchema).min(2).max(15) }).superRefine((out, ctx) => {
  if (!out.questions.some((q) => q.type === "true_false") || !out.questions.some((q) => q.type === "multiple_choice"))
    ctx.addIssue({ code: "custom", message: "Include both multiple-choice and true/false questions" });
});

export function studySource(notes: { title: string; transcript: string | null; summary: string | null }[]) {
  const useful = notes.filter((n) => n.transcript?.trim() || n.summary?.trim());
  if (!useful.length) throw new Error("Add a transcript or study notes before generating practice material.");
  const allowance = Math.floor(56000 / useful.length);
  return useful.map((n) => `${n.title}\n${[n.summary, n.transcript].filter(Boolean).join("\n").slice(0, allowance)}`).join("\n\n---\n\n");
}

export function reviewDueAt(rating: StudyRating, now = Date.now()) {
  return new Date(now + ({ hard: 0.007, medium: 1, easy: 4 }[rating]) * 86400000).toISOString();
}