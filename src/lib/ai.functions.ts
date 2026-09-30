import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function askJson(prompt: string): Promise<unknown> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI service is not configured");
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a study assistant. Always reply with valid JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (response.status === 429) throw new Error("Too many AI requests — try again in a minute.");
  if (response.status === 402) throw new Error("AI credits are used up for this workspace.");
  if (!response.ok) throw new Error(`AI request failed (${response.status})`);
  const result = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = result.choices?.[0]?.message?.content ?? "{}";
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
