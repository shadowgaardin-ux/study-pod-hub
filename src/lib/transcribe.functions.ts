import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifyNoteAudio } from "./security-validation";

/**
 * Transcribe a note's audio with AI and save the transcript on the note.
 * Runs as the signed-in user, so storage and note access follow the same
 * rules as the app itself.
 */
export const transcribeNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ noteId: z.string().uuid(), audioPath: z.string().min(1).max(1024) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: note, error: noteError } = await supabase.from("notes")
      .select("created_by, pod_id, audio_url").eq("id", data.noteId).maybeSingle();
    if (noteError) throw new Error("Could not read this note");
    let isAdmin = false;
    if (note?.pod_id && note.created_by !== context.userId) {
      const { data: admin, error } = await supabase.rpc("is_pod_admin", { _pod_id: note.pod_id, _user_id: context.userId });
      if (error) throw new Error("Could not verify note permissions");
      isAdmin = admin === true;
    }
    verifyNoteAudio(note, context.userId, data.audioPath, isAdmin);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("pod-audio")
      .download(data.audioPath);
    if (downloadError || !fileData) {
      throw new Error(downloadError?.message ?? "Could not read the audio file");
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    if (bytes.byteLength > 20 * 1024 * 1024) {
      throw new Error("That recording is too long to transcribe automatically");
    }
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const base64 = btoa(binary);
    const ext = data.audioPath.split(".").pop()?.toLowerCase() ?? "webm";
    const format = ["mp3", "wav", "m4a", "ogg", "webm", "mp4"].includes(ext) ? ext : "webm";

    const { transcribeAudioBase64 } = await import("./ai-provider.server");
    const transcript = await transcribeAudioBase64(
      base64,
      format,
      "Transcribe this lecture recording verbatim. Output only the transcript text, no commentary.",
    );
    if (!transcript) throw new Error("The AI returned an empty transcript");

    const { error: updateError } = await supabase
      .from("notes")
      .update({ transcript })
      .eq("id", data.noteId).select("id").single();
    if (updateError) throw new Error(updateError.message);

    return { transcript };
  });
