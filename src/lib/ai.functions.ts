import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function askJson(prompt: string): Promise<unknown> {
  const { generateText } = await import("./ai-provider.server");
  const content =
    (await generateText("You are a study assistant. Always reply with valid JSON only.", prompt, true)) || "{}";
  try {
    return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error("The AI returned an unreadable answer — please try again.");
  }
}

const PROMPTS = {
  bullets: 'Summarise these notes into 5-8 concise bullet points. JSON: {"items": string[]}',
  terms: 'Extract the 8-12 most important key terms with a one-line definition each, formatted "Term — definition". JSON: {"items": string[]}',
  quiz: 'Write 5 short-answer study questions with answers, formatted "Q: ... — A: ...". JSON: {"items": string[]}',
} as const;

export const studyAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ action: z.enum(["bullets", "terms", "quiz"]), text: z.string().min(1).max(60000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const out = (await askJson(`${PROMPTS[data.action]}\n\nNotes:\n${data.text}`)) as { items?: unknown };
    const items = Array.isArray(out.items) ? out.items.filter((i): i is string => typeof i === "string") : [];
    if (!items.length) throw new Error("The AI didn't return anything — try again.");
    return { items };
  });

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export const generatePodQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ podId: z.string().uuid(), count: z.number().int().min(3).max(15) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: notes, error } = await context.supabase
      .from("notes")
      .select("title, transcript, summary")
      .eq("pod_id", data.podId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const text = (notes ?? [])
      .map((n) => [n.title, n.summary, n.transcript].filter(Boolean).join("\n"))
      .join("\n\n---\n\n")
      .slice(0, 60000);
    if (!(notes ?? []).some((n) => n.transcript || n.summary)) {
      throw new Error("Add or transcribe some notes in this pod first.");
    }
    const out = (await askJson(
      `Create ${data.count} multiple-choice questions from these lecture notes. Each has exactly 4 options and one correct answer (0-based index). JSON: {"questions": [{"question": string, "options": string[4], "answer": number, "explanation": string}]}\n\nNotes:\n${text}`,
    )) as { questions?: unknown };
    const questions = (Array.isArray(out.questions) ? out.questions : []).filter(
      (q): q is QuizQuestion =>
        !!q &&
        typeof (q as QuizQuestion).question === "string" &&
        Array.isArray((q as QuizQuestion).options) &&
        (q as QuizQuestion).options.length >= 2 &&
        typeof (q as QuizQuestion).answer === "number",
    );
    if (!questions.length) throw new Error("The AI didn't return a quiz — try again.");
    return { questions };
  });

export interface AskNotesSource { ref: string; noteId: string; noteTitle: string; excerpt: string }

export const askMyNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        question: z.string().trim().min(2).max(1000),
        noteId: z.string().uuid().optional(),
        course: z.string().max(120).nullable().optional(),
        semester: z.string().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { buildSections, pickSources } = await import("./ask-notes");
    let q = context.supabase.from("notes").select("id, title, transcript, summary");
    if (data.noteId) q = q.eq("id", data.noteId);
    else {
      q = q.eq("created_by", context.userId);
      q = data.course ? q.eq("course", data.course) : q.is("course", null);
      q = data.semester ? q.eq("semester", data.semester) : q.is("semester", null);
    }
    const { data: notes, error } = await q.order("created_at", { ascending: false }).limit(30);
    if (error) throw new Error("Couldn't load your notes — please try again.");
    const sections = buildSections(notes ?? []);
    if (!sections.length) throw new Error("There's no transcript or summary to search yet. Transcribe a lecture first.");
    const out = (await askJson(
      `Answer the student's question using ONLY the note sections below. If the sections don't contain the answer, say so plainly and do not use outside knowledge. Keep the answer short and clear. Cite the refs of the sections you used.\nJSON: {"answer": string, "sources": string[]}\n\nQuestion: ${data.question}\n\nSections:\n${sections.map((s) => `[${s.ref}] (${s.noteTitle}) ${s.text}`).join("\n")}`,
    )) as { answer?: unknown; sources?: unknown };
    const answer = typeof out.answer === "string" ? out.answer.trim() : "";
    if (!answer) throw new Error("The AI didn't return an answer — try again.");
    const sources: AskNotesSource[] = pickSources(sections, out.sources).map((s) => ({
      ref: s.ref, noteId: s.noteId, noteTitle: s.noteTitle, excerpt: s.text.slice(0, 320),
    }));
    return { answer, sources };
  });
