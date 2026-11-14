/**
 * Server-only AI provider. Uses Google Gemini when GEMINI_API_KEY is set
 * (e.g. on Vercel); otherwise falls back to the Lovable AI gateway.
 * Keys are read inside calls and never sent to the browser.
 */
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function geminiModel() {
  return process.env["GEMINI_MODEL"]?.trim() || "gemini-2.5-flash";
}

function statusError(status: number): Error {
  if (status === 429) return new Error("AI is busy — try again in a minute.");
  if (status === 402) return new Error("AI credits have run out.");
  if (status === 401 || status === 403) return new Error("AI service key was rejected — check the server configuration.");
  return new Error(`AI request failed (${status})`);
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function gemini(key: string, parts: Part[], system?: string, json = false): Promise<string> {
  const res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(geminiModel())}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts }],
      ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    }),
  });
  if (!res.ok) {
    console.error("Gemini request failed", res.status);
    throw statusError(res.status);
  }
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
}

async function lovable(key: string, model: string, messages: unknown[], json = false): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, ...(json ? { response_format: { type: "json_object" } } : {}) }),
  });
  if (!res.ok) {
    console.error("AI gateway request failed", res.status);
    throw statusError(res.status);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content?.trim() ?? "";
}

function keys() {
  const geminiKey = process.env["GEMINI_API_KEY"]?.trim();
  const lovableKey = process.env["LOVABLE_API_KEY"]?.trim();
  if (!geminiKey && !lovableKey) throw new Error("AI service is not configured");
  return { geminiKey, lovableKey };
}

export async function generateText(system: string, prompt: string, json = false): Promise<string> {
  const { geminiKey, lovableKey } = keys();
  if (geminiKey) return gemini(geminiKey, [{ text: prompt }], system, json);
  return lovable(lovableKey!, "google/gemini-3-flash-preview", [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ], json);
}

const AUDIO_MIME: Record<string, string> = {
  mp3: "audio/mp3", wav: "audio/wav", m4a: "audio/mp4", mp4: "audio/mp4",
  ogg: "audio/ogg", webm: "audio/webm", aac: "audio/aac",
};

export async function transcribeAudioBase64(base64: string, format: string, instruction: string): Promise<string> {
  const { geminiKey, lovableKey } = keys();
  if (geminiKey) {
    return gemini(geminiKey, [
      { text: instruction },
      { inline_data: { mime_type: AUDIO_MIME[format] ?? "audio/webm", data: base64 } },
    ]);
  }
  return lovable(lovableKey!, "google/gemini-3.8-flash", [
    { role: "user", content: [
      { type: "text", text: instruction },
      { type: "input_audio", input_audio: { data: base64, format } },
    ] },
  ]);
}
