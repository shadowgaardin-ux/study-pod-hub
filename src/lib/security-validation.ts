/** Shared allowlists; the storage boundary applies the same extension checks. */
export const SAFE_AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "ogg", "webm", "aac", "mp4"];
export const SAFE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];
export const SAFE_DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx"];

export function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isSafeFile(name: string, mime: string, category: "audio" | "image" | "file"): boolean {
  const ext = fileExtension(name);
  const baseMime = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  const fallback = baseMime === "" || baseMime === "application/octet-stream";
  if (category === "audio") return SAFE_AUDIO_EXTENSIONS.includes(ext) && (fallback || baseMime.startsWith("audio/") || (ext === "mp4" && baseMime === "video/mp4") || (ext === "webm" && baseMime === "video/webm"));
  if (category === "image") return SAFE_IMAGE_EXTENSIONS.includes(ext) && (fallback || ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"].includes(baseMime));
  return SAFE_DOCUMENT_EXTENSIONS.includes(ext) && (fallback || baseMime === "application/pdf" || baseMime === "application/msword" || baseMime === "application/vnd.ms-powerpoint" || baseMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || baseMime === "application/vnd.openxmlformats-officedocument.presentationml.presentation");
}

export function verifyNoteAudio(note: { created_by: string; pod_id: string | null; audio_url: string | null } | null, userId: string, audioPath: string, isAdmin: boolean): void {
  if (!note || note.audio_url !== audioPath || (note.created_by !== userId && !isAdmin)) {
    throw new Error("You cannot transcribe this note");
  }
}