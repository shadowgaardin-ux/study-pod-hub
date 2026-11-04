import { useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileAudio, FileText, Mic, Share2, Trash2 } from "lucide-react";

import { NoteViewer } from "@/components/notes/note-viewer";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { exportNotePdf, exportNoteTxt } from "@/lib/export-note";
import { planFor } from "@/lib/tiers";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { usePersonalNotes, type LibraryNote } from "@/lib/library";
import type { PodWithCount } from "@/lib/queries";

export function PersonalLibrary({
  userId,
  pods,
}: {
  userId: string | undefined;
  pods: PodWithCount[] | undefined;
}) {
  const notes = usePersonalNotes(userId);
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const plan = planFor(profile?.tier);
  const [sharing, setSharing] = useState<LibraryNote | null>(null);
  const [podId, setPodId] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewing = notes.data?.find((n) => n.id === viewingId) ?? null;
  const setViewing = (note: LibraryNote | null) => setViewingId(note?.id ?? null);

  async function remove(note: LibraryNote) {
    const { error } = await supabase.from("notes").delete().eq("id", note.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Recording deleted");
    await queryClient.invalidateQueries();
  }

  async function share() {
    if (!sharing || !podId) return;
    setBusy(true);
    const { error } = await supabase.from("notes").update({ pod_id: podId }).eq("id", sharing.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Shared to your pod");
    setSharing(null);
    setPodId("");
    await queryClient.invalidateQueries();
  }

  if (notes.isLoading) return <Skeleton className="h-40 rounded-xl" />;

  if (!notes.data?.length) {
    return (
      <EmptyState
        icon={Mic}
        title="Your library is empty"
        description="Record a lecture or upload a file above — it stays private to you until you share it to a pod."
      />
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {notes.data.map((note) => (
          <Card key={note.id}>
            <CardContent className="flex h-full flex-col gap-3 pt-6">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileAudio className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{note.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(note.created_at).toLocaleDateString()} · Private
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewing(note)}
                className="rounded-md bg-muted/60 p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                {note.transcript || note.summary ? (
                  <span className="line-clamp-3">{note.transcript || note.summary}</span>
                ) : (
                  <span className="italic">No transcript yet — tap to open and transcribe.</span>
                )}
              </button>
              <div className="mt-auto flex flex-col gap-2">
                <Button size="sm" className="w-full gap-2" onClick={() => setViewing(note)}>
                  <Eye className="size-4" /> Open & edit transcript
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={!pods?.length}
                  onClick={() => {
                    setSharing(note);
                    setPodId(pods?.[0]?.id ?? "");
                  }}
                >
                  <Share2 className="size-4" /> Share to pod
                </Button>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 gap-1.5"
                    disabled={!note.transcript && !note.summary}
                    onClick={() => exportNoteTxt(note)}
                  >
                    <FileText className="size-3.5" /> TXT
                  </Button>
                  {plan.exports.includes("pdf") ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 gap-1.5"
                      disabled={!note.transcript && !note.summary}
                      onClick={() => exportNotePdf(note)}
                    >
                      <Download className="size-3.5" /> PDF
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => void remove(note)}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <NoteViewer
        note={viewing}
        userId={userId}
        onOpenChange={(open) => !open && setViewing(null)}
      />

      <Dialog open={sharing !== null} onOpenChange={(open) => !open && setSharing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="display">Share to a pod</DialogTitle>
            <DialogDescription>
              Everyone in the pod will be able to open “{sharing?.title}”.
            </DialogDescription>
          </DialogHeader>
          <Select value={podId} onValueChange={setPodId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a pod" />
            </SelectTrigger>
            <SelectContent>
              {(pods ?? []).map((pod) => (
                <SelectItem key={pod.id} value={pod.id}>
                  {pod.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button disabled={busy || !podId} onClick={() => void share()}>
              {busy ? "Sharing…" : "Share"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
