import { useQueryClient } from "@tanstack/react-query";
import { Download, FileAudio, FileText, Mic, Share2, Trash2 } from "lucide-react";
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
              {note.summary ? (
                <p className="line-clamp-3 text-sm text-muted-foreground">{note.summary}</p>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="mt-auto w-full gap-2"
                disabled={!pods?.length}
                onClick={() => {
                  setSharing(note);
                  setPodId(pods?.[0]?.id ?? "");
                }}
              >
                <Share2 className="size-4" /> Share to pod
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

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
