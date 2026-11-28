import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { combineCourseNotes, exportNotePdf, exportNoteTxt, exportNotesDocx, type ExportableNote } from "@/lib/export-note";

export function NoteExportMenu({ notes, title, allowPdf = true }: { notes: ExportableNote[]; title: string; allowPdf?: boolean }) {
  const [busy, setBusy] = useState(false);
  const note = notes.length === 1 ? notes[0] : combineCourseNotes(notes, title);
  async function word() {
    setBusy(true);
    try { await exportNotesDocx(notes, title); } catch { toast.error("Couldn't export the Word document. Please try again."); } finally { setBusy(false); }
  }
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={busy || !notes.length} aria-label={`Export ${title}`}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Export
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => note && exportNoteTxt(note)}>Text (.txt)</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void word()}>Word (.docx)</DropdownMenuItem>
      {allowPdf ? <DropdownMenuItem onSelect={() => note && exportNotePdf(note)}>PDF (print / save)</DropdownMenuItem> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}