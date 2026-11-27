/** Pure helpers for "Ask My Notes": split notes into citable sections and map AI citations back to them. */
export interface NoteSource { id: string; title: string; transcript: string | null; summary: string | null }
export interface NoteSection { ref: string; noteId: string; noteTitle: string; text: string }

export function buildSections(notes: NoteSource[], size = 900, maxSections = 80): NoteSection[] {
  const out: NoteSection[] = [];
  notes.forEach((note, n) => {
    const body = [note.summary ? `Summary: ${note.summary}` : "", note.transcript ?? ""]
      .filter((s) => s.trim()).join("\n").replace(/\s+/g, " ").trim();
    let part = 0;
    for (let i = 0; i < body.length; i += size) {
      out.push({ ref: `S${n + 1}.${++part}`, noteId: note.id, noteTitle: note.title, text: body.slice(i, i + size) });
    }
  });
  return out.slice(0, maxSections);
}

export function pickSources(sections: NoteSection[], refs: unknown, limit = 3): NoteSection[] {
  if (!Array.isArray(refs)) return [];
  const byRef = new Map(sections.map((s) => [s.ref, s]));
  const seen = new Set<string>();
  const picked: NoteSection[] = [];
  for (const r of refs) {
    const s = typeof r === "string" ? byRef.get(r.trim()) : undefined;
    if (s && !seen.has(s.ref)) { seen.add(s.ref); picked.push(s); }
    if (picked.length >= limit) break;
  }
  return picked;
}
