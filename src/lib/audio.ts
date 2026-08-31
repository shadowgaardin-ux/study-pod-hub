/**
 * Audio capture helpers: client-side compression settings, an IndexedDB
 * buffer so an in-progress recording survives a network drop or reload,
 * and upload validation.
 */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const UPLOAD_ACCEPT =
  "audio/*,.mp3,.m4a,.wav,.ogg,.webm,application/pdf,.pdf,.ppt,.pptx";
export const UPLOAD_HINT = ".mp3, .m4a, .wav, .pdf, .pptx — Max 50MB";

const ALLOWED_EXT = ["mp3", "m4a", "wav", "ogg", "webm", "pdf", "ppt", "pptx"];

export function validateUpload(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext) && !file.type.startsWith("audio/")) {
    return `Unsupported file type. Allowed: ${UPLOAD_HINT}`;
  }
  if (file.size > MAX_UPLOAD_BYTES) return "That file is larger than the 50MB limit";
  return null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatTimer(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Mono, 32 kbps — roughly 6x smaller than a default browser recording. */
export const COMPRESSED_BITRATE = 32_000;

export const RECORD_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    sampleRate: 22_050,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/* ---------------------------------------------------------------- */
/* IndexedDB buffer                                                   */
/* ---------------------------------------------------------------- */

const DB_NAME = "study-notes-audio";
const STORE = "chunks";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export interface BufferedChunk {
  key: string;
  sessionId: string;
  index: number;
  startedAt: number;
  mimeType: string;
  blob: Blob;
}

export async function bufferChunk(chunk: Omit<BufferedChunk, "key">) {
  await tx("readwrite", (store) =>
    store.put({ ...chunk, key: `${chunk.sessionId}:${chunk.index}` }),
  );
}

export async function readSession(sessionId: string): Promise<BufferedChunk[]> {
  const all = await tx<BufferedChunk[]>("readonly", (store) => store.getAll() as never);
  return all.filter((c) => c.sessionId === sessionId).sort((a, b) => a.index - b.index);
}

export async function listBufferedSessions(): Promise<
  { sessionId: string; startedAt: number; mimeType: string; size: number }[]
> {
  const all = await tx<BufferedChunk[]>("readonly", (store) => store.getAll() as never);
  const map = new Map<string, { sessionId: string; startedAt: number; mimeType: string; size: number }>();
  for (const chunk of all) {
    const entry = map.get(chunk.sessionId) ?? {
      sessionId: chunk.sessionId,
      startedAt: chunk.startedAt,
      mimeType: chunk.mimeType,
      size: 0,
    };
    entry.size += chunk.blob.size;
    map.set(chunk.sessionId, entry);
  }
  return [...map.values()].sort((a, b) => b.startedAt - a.startedAt);
}

export async function clearSession(sessionId: string) {
  const chunks = await readSession(sessionId);
  await Promise.all(chunks.map((chunk) => tx("readwrite", (store) => store.delete(chunk.key) as never)));
}

export async function assembleSession(sessionId: string): Promise<Blob | null> {
  const chunks = await readSession(sessionId);
  if (!chunks.length) return null;
  return new Blob(
    chunks.map((c) => c.blob),
    { type: chunks[0]!.mimeType || "audio/webm" },
  );
}
