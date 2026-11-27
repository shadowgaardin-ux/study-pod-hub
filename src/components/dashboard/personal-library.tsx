import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  Download,
  Eye,
  FileAudio,
  FileText,
  Mic,
  Share2,
  Trash2,
} from "lucide-react";

import { NoteViewer } from "@/components/notes/note-viewer";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { AskMyNotes } from "@/components/notes/ask-my-notes";
import { groupNotesBySemester, organizationSuggestions } from "@/lib/course-organization";
import { exportNotePdf, exportNoteTxt } from "@/lib/export-note";
import { planFor } from "@/lib/tiers";

import { Badge } from "@/components/ui/badge";
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
  const semesterGroups = groupNotesBySemester(notes.data ?? []);
  const semesters = organizationSuggestions(notes.data ?? [], "semester");
  const courses = organizationSuggestions(notes.data ?? [], "course");

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

  function renderNote(note: LibraryNote) {
    return (
      <Card key={note.id} className="lift group">
        <CardContent className="flex h-full flex-col gap-3 pt-6">
          <div className="flex items-start gap-3">
            <span className="icon-chip size-10 transition-transform duration-300 group-hover:scale-105">
              {note.audio_url ? <FileAudio className="size-4" /> : <FileText className="size-4" />}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{note.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(note.created_at).toLocaleDateString()} ·{" "}
                <span className="text-brand-sky">Private</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setViewing(note)}
            className="h-auto justify-start whitespace-normal rounded-lg border border-border/60 bg-secondary/40 p-3 text-left text-sm font-normal text-muted-foreground hover:border-primary/30 hover:bg-secondary"
          >
            {note.transcript || note.summary ? (
              <span className="line-clamp-3">{note.transcript || note.summary}</span>
            ) : (
              <span className="italic">No transcript yet — tap to open and transcribe.</span>
            )}
          </Button>
          <div className="mt-auto flex flex-col gap-2">
            <Button size="sm" className="w-full gap-2" onClick={() => setViewing(note)}>
              <Eye className="size-4" /> Open note
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
    );
  }

  if (notes.isLoading) {
    return (
      <div className="grid gap-3 min-[640px]:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

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
      <div className="space-y-8">
        {semesterGroups.map((semesterGroup) => {
          const noteCount = semesterGroup.courses.reduce(
            (total, courseGroup) => total + courseGroup.notes.length,
            0,
          );
          return (
            <section key={semesterGroup.semester ?? "unorganized"} className="space-y-5">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <CalendarDays className="size-4 shrink-0 text-primary" />
                <h2 className="font-semibold">{semesterGroup.semester ?? "Unorganized"}</h2>
                <Badge variant="soft" className="ml-auto">
                  {noteCount} {noteCount === 1 ? "note" : "notes"}
                </Badge>
              </div>
              <div className="space-y-6">
                {semesterGroup.courses.map((courseGroup) => (
                  <section key={courseGroup.course ?? "no-course"} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="size-4 shrink-0 text-brand-sky" />
                      <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
                        {courseGroup.course ?? "No course assigned"}
                      </h3>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {courseGroup.notes.length}{" "}
                        {courseGroup.notes.length === 1 ? "lecture" : "lectures"}
                      </span>
                    </div>
                    <AskMyNotes
                      scope={{ course: courseGroup.course, semester: semesterGroup.semester }}
                      label={`Ask My Notes about ${courseGroup.course ?? "these notes"}`}
                    />
                    <div className="stagger grid gap-3 min-[640px]:grid-cols-2">
                      {courseGroup.notes.map(renderNote)}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <NoteViewer
        note={viewing}
        userId={userId}
        semesters={semesters}
        courses={courses}
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
