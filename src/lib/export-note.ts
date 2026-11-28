/** Download a note's text (transcript/summary) as a .txt file. */
export function exportNoteTxt(note: { title: string; transcript: string | null; summary: string | null; created_at: string }) {
  const lines = [
    note.title,
    new Date(note.created_at).toLocaleString(),
    "",
    note.transcript ?? "",
    note.summary ? `\n--- Summary ---\n${note.summary}` : "",
  ];
  const blob = new Blob([lines.join("\n").trim() + "\n"], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${note.title.replace(/[^\w\- ]+/g, "").trim() || "note"}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Open a printable view of the note so the user can save it as PDF. */
export function exportNotePdf(note: { title: string; transcript: string | null; summary: string | null; created_at: string }) {
  const win = window.open("", "_blank");
  if (!win) return;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  win.document.write(`<!doctype html><html><head><title>${esc(note.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#111}
h1{font-size:1.5rem}p.meta{color:#666;font-size:.85rem}pre{white-space:pre-wrap;font:inherit}</style>
</head><body>
<h1>${esc(note.title)}</h1>
<p class="meta">${esc(new Date(note.created_at).toLocaleString())}</p>
<pre>${esc(note.transcript ?? "")}</pre>
${note.summary ? `<h2>Summary</h2><pre>${esc(note.summary)}</pre>` : ""}
</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export type ExportableNote = { title: string; transcript: string | null; summary: string | null; created_at: string; semester?: string | null; course?: string | null };

/** Build a genuine Office Open XML document, rather than renaming HTML. */
export async function exportNotesDocx(notes: ExportableNote[], title: string) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const paragraphs = notes.flatMap((n) => [
    new Paragraph({ text: n.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: [n.semester, n.course, new Date(n.created_at).toLocaleDateString()].filter(Boolean).join(" · "), italics: true })] }),
    ...(n.summary ? [new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }), ...n.summary.split("\n").map((text) => new Paragraph({ text }))] : []),
    new Paragraph({ text: "Lecture notes", heading: HeadingLevel.HEADING_2 }),
    ...(n.transcript ?? "").split("\n").map((text) => new Paragraph({ text })),
  ]);
  const blob = await Packer.toBlob(new Document({ sections: [{ children: paragraphs }] }));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "notes"}.docx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function combineCourseNotes(notes: ExportableNote[], title: string): ExportableNote {
  return {
    title,
    created_at: notes[0]?.created_at ?? new Date().toISOString(),
    transcript: notes.map((n) => [n.title, [n.semester, n.course].filter(Boolean).join(" · "), n.transcript, n.summary ? `Summary\n${n.summary}` : null].filter(Boolean).join("\n\n")).join("\n\n──────────\n\n"),
    summary: null,
  };
}
