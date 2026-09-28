import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Transcribe a note's audio with AI and save the transcript on the note.
 * Runs as the signed-in user, so storage and note access follow the same
 * rules as the app itself.
 */
export const transcribeNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ noteId: z.string(), audioPath: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("pod-audio")
      .download(data.audioPath);
    if (downloadError || !fileData) {
      throw new Error(downloadError?.message ?? "Could not read the audio file");
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    if (buffer.byteLength > 20 * 1024 * 1024) {
      throw new Error("That recording is too long to transcribe automatically");
    }
    const base64 = buffer.toString("base64");
    const ext = data.audioPath.split(".").pop()?.toLowerCase() ?? "webm";
    const format = ["mp3", "wav", "m4a", "ogg", "webm", "mp4"].includes(ext) ? ext : "webm";

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI service is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe this lecture recording verbatim. Output only the transcript text, no commentary.",
              },
              { type: "input_audio", input_audio: { data: base64, format } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Transcription failed [${response.status}]: ${body}`);
    }

    const result = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const transcript = result.choices?.[0]?.message?.content?.trim();
    if (!transcript) throw new Error("The AI returned an empty transcript");

    const { error: updateError } = await supabase
      .from("notes")
      .update({ transcript })
      .eq("id", data.noteId);
    if (updateError) throw new Error(updateError.message);

    return { transcript };
  });
