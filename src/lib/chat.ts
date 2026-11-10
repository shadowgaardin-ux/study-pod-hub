/**
 * Hub chat helpers: attachment classification, validation and an upload
 * that reports progress. Kept free of React so it can be unit tested.
 */

import { isSafeFile } from "./security-validation";

export type ChatKind = "text" | "image" | "file" | "voice" | "audio";

export interface ChatMessage {
  id: string;
  pod_id: string;
  user_id: string;
  message: string;
  created_at: string;
  kind: string;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  pinned_at: string | null;
  pinned_by: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  duration_ms: number | null;
}

export interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export const CHAT_BUCKET = "pod-chat";
export const CHAT_MAX_BYTES = 25 * 1024 * 1024;
export const CHAT_ACCEPT =
  "image/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.mp3,.m4a,.wav,.ogg,.webm";
export const CHAT_HINT = "Images, PDF, Word, PowerPoint or audio — max 25MB";

const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];
const AUDIO_EXT = ["mp3", "m4a", "wav", "ogg", "webm", "aac"];
const DOC_EXT = ["pdf", "doc", "docx", "ppt", "pptx"];

export function extOf(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() ?? "" : "";
}

/** Decide how a file is shown. Documents are never treated as audio. */
export function classifyFile(name: string, mime: string): Exclude<ChatKind, "text" | "voice"> | null {
  if (isSafeFile(name, mime, "file")) return "file";
  if (isSafeFile(name, mime, "image")) return "image";
  if (isSafeFile(name, mime, "audio")) return "audio";
  return null;
}

export function validateChatFile(file: { name: string; type: string; size: number }): string | null {
  if (!classifyFile(file.name, file.type)) return `Unsupported file. ${CHAT_HINT}`;
  if (file.size > CHAT_MAX_BYTES) return "That file is larger than the 25MB limit";
  if (file.size === 0) return "That file is empty";
  return null;
}

export function docLabel(name: string) {
  const ext = extOf(name);
  if (ext === "pdf") return "PDF";
  if (ext === "doc" || ext === "docx") return "Word";
  if (ext === "ppt" || ext === "pptx") return "PowerPoint";
  return ext.toUpperCase() || "File";
}

export function safeFileName(name: string) {
  const cleaned = name.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(-80) || "file";
}

export function chatPath(podId: string, userId: string, name: string) {
  return `${podId}/${userId}/${crypto.randomUUID()}-${safeFileName(name)}`;
}

export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** Upload with progress through the storage REST endpoint. */
export function uploadWithProgress(opts: {
  url: string;
  apikey: string;
  token: string;
  path: string;
  file: Blob;
  contentType: string;
  onProgress: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const encoded = opts.path.split("/").map(encodeURIComponent).join("/");
    xhr.open("POST", `${opts.url}/storage/v1/object/${CHAT_BUCKET}/${encoded}`);
    xhr.setRequestHeader("Authorization", `Bearer ${opts.token}`);
    xhr.setRequestHeader("apikey", opts.apikey);
    xhr.setRequestHeader("Content-Type", opts.contentType || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = "Upload failed";
        try {
          msg = JSON.parse(xhr.responseText).message ?? msg;
        } catch {
          /* keep default */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error — check your connection and retry"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    opts.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(opts.file);
  });
}
