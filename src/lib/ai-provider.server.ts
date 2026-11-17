/**
 * Server-only AI provider: Google Gemini via the server-side GEMINI_API_KEY.
 * Used by transcription, summaries (bullet points), key terms, study questions,
 * pod quizzes and the AI assistant. The key is read inside each call on the
 * server and is never sent to the browser.
 */
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function geminiModel() {
  return process.env["GEMINI_MODEL"]?.trim() || "gemini-3.5-flash-lite";
}

function geminiKey(): string {
  const key = process.env["GEMINI_API_KEY"]?.trim().replace(/^["']|["']$/g, "");
  if (!key) {
    console.error("GEMINI_API_KEY is not set in the server environment");
    throw new Error("AI service is not configured (GEMINI_API_KEY missing on the server)");
  }
  return key;
}

function statusError(status: number): Error {
  if (status === 429) return new Error("AI is busy — try again in a minute.");
  if (status === 400) return new Error("Gemini rejected the request — the audio or text may be unsupported.");
  if (status === 401 || status === 403) return new Error("Gemini API key was rejected — check GEMINI_API_KEY.");
  if (status === 404) return new Error("Gemini model not found — check GEMINI_MODEL.");
  return new Error(`AI request failed (${status})`);
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function gemini(parts: Part[], system?: string, json = false): Promise<string> {
  const key = geminiKey();
  const model = geminiModel();
  const res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts }],
      ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 500);
    console.error("Gemini request failed", { status: res.status, model, detail });
    throw statusError(res.status);
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) {
    console.error("Gemini returned no text", {
      model,
      finishReason: body.candidates?.[0]?.finishReason,
      blockReason: body.promptFeedback?.blockReason,
    });
  }
  return text;
}

export async function generateText(system: string, prompt: string, json = false): Promise<string> {
  return gemini([{ text: prompt }], system, json);
}

const AUDIO_MIME: Record<string, string> = {
  mp3: "audio/mp3", wav: "audio/wav", m4a: "audio/mp4", mp4: "audio/mp4",
  ogg: "audio/ogg", webm: "audio/webm", aac: "audio/aac",
};

export async function transcribeAudioBase64(base64: string, format: string, instruction: string): Promise<string> {
  return gemini([
    { text: instruction },
    { inline_data: { mime_type: AUDIO_MIME[format] ?? "audio/webm", data: base64 } },
  ]);
}
