import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Link2, Loader2, Share2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { createNoteShare } from "@/lib/note-sharing.functions";

export function NoteShare({ noteId, title }: { noteId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(true);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createNoteShare);
  const cache = useQueryClient();
  const share = useQuery({ queryKey: ["note-share", noteId], enabled: open, queryFn: async () => {
    const { data, error } = await supabase.from("note_shares").select("can_edit").eq("note_id", noteId).maybeSingle();
    if (error) throw new Error("Couldn't load sharing settings.");
    return data;
  } });
  useEffect(() => { if (share.data) setViewOnly(!share.data.can_edit); }, [share.data]);
  async function generate() {
    setBusy(true);
    try {
      const { token } = await create({ data: { noteId, canEdit: !viewOnly } });
      setLink(`${window.location.origin}/share/${token}`);
      await cache.invalidateQueries({ queryKey: ["note-share", noteId] });
      toast.success("Sharing link ready");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't create a link."); } finally { setBusy(false); }
  }
  async function revoke() {
    setBusy(true);
    try {
      const { error } = await supabase.from("note_shares").delete().eq("note_id", noteId);
      if (error) throw error;
      setLink("");
      await cache.invalidateQueries({ queryKey: ["note-share", noteId] });
      toast.success("Link revoked");
    } catch { toast.error("Couldn't revoke this link. Please try again."); } finally { setBusy(false); }
  }
  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Share2 className="size-4" /> Share link</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogHeader><DialogTitle>Share “{title}”</DialogTitle><DialogDescription>Anyone with the link can open this note's text. Your recording and other private files are not shared.</DialogDescription></DialogHeader>
      <div className="flex items-center justify-between gap-4"><label htmlFor={`view-only-${noteId}`} className="text-sm font-medium">View-only</label><Switch id={`view-only-${noteId}`} checked={viewOnly} disabled={busy} onCheckedChange={setViewOnly} /></div>
      <p className="flex gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" />{viewOnly ? "Recipients can read the note, but cannot change it." : "Anyone with this link can edit the original title, transcript and summary."}</p>
      {share.isError ? <p className="text-sm text-destructive">Couldn't load sharing settings. Close and try again.</p> : null}
      {share.data ? <p className="text-xs text-muted-foreground">Active link: {share.data.can_edit ? "editing allowed" : "view-only"}. Replacing the link disables the previous one.</p> : null}
      {link ? <div className="flex gap-2"><Input aria-label="Sharing link" value={link} readOnly /><Button size="icon" variant="outline" aria-label="Copy sharing link" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Link copied"), () => toast.error("Select and copy the link manually."))}><Copy className="size-4" /></Button></div> : null}
      <div className="flex flex-wrap gap-2"><Button disabled={busy || share.isLoading || share.isError} onClick={() => void generate()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}{share.data ? "Replace link / apply permissions" : "Create link"}</Button>{share.data ? <Button variant="outline" disabled={busy} onClick={() => void revoke()}>Revoke link</Button> : null}</div>
    </DialogContent></Dialog>
  </>;
}