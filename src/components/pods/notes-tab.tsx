import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileAudio, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { exportNotePdf, exportNoteTxt } from "@/lib/export-note";
import { planFor } from "@/lib/tiers";
import { transcribeNote } from "@/lib/transcribe.functions";
import { validateUpload } from "@/lib/audio";
import { isSafeFile } from "@/lib/security-validation";

import { NoteViewer } from "@/components/notes/note-viewer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export interface Note {
  id: string;
  pod_id: string;
  created_by: string;
  title: string;
  audio_url: string | null;
  transcript: string | null;
  summary: string | null;
  created_at: string;
}

export function NotesTab({ podId, userId }: { podId: string; userId: string | undefined }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [playerUrls, setPlayerUrls] = useState<Record<string, string>>({});
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const runTranscribe = useServerFn(transcribeNote);
  const { profile } = useAuth();
  const plan = planFor(profile?.tier);

  const notes = useQuery({
    queryKey: ["notes", podId],
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("pod_id", podId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  async function createNote(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setBusy(true);
    let audioPath: string | null = null;

    if (file) {
      const fileError = validateUpload(file);
      if (fileError || !isSafeFile(file.name, file.type, "audio")) {
        setBusy(false);
        toast.error(fileError ?? "Choose a supported audio file");
        return;
      }
      const path = `${podId}/${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("pod-audio").upload(path, file);
      if (uploadError) {
        setBusy(false);
        toast.error(uploadError.message);
        return;
      }
      audioPath = path;
    }

    const { error } = await supabase.from("notes").insert({
      pod_id: podId,
      created_by: userId,
      title: title.trim(),
      transcript: transcript.trim() || null,
      audio_url: audioPath,
    });
    setBusy(false);
    if (error) {
      if (audioPath) await supabase.storage.from("pod-audio").remove([audioPath]);
      toast.error(error.message);
      return;
    }
    toast.success("Note added");
    setTitle("");
    setTranscript("");
    setFile(null);
    setOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["notes", podId] });
  }

  async function togglePlayer(noteId: string, path: string) {
    if (playerUrls[noteId]) {
      setPlayerUrls((prev) => {
        const next = { ...prev };
        delete next[noteId];
        return next;
      });
      return;
    }
    const { data, error } = await supabase.storage.from("pod-audio").createSignedUrl(path, 120);
    if (error || !data) {
      toast.error("Could not open audio");
      return;
    }
    setPlayerUrls((prev) => ({ ...prev, [noteId]: data.signedUrl }));
  }

  async function transcribe(note: Note) {
    if (!note.audio_url) return;
    setTranscribingId(note.id);
    try {
      await runTranscribe({ data: { noteId: note.id, audioPath: note.audio_url } });
      toast.success("Transcript ready");
      await queryClient.invalidateQueries({ queryKey: ["notes", podId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transcription failed");
    } finally {
      setTranscribingId(null);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["notes", podId] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="display text-xl font-semibold">Shared notes &amp; recordings</h2><p className="mt-1 text-xs text-muted-foreground">{notes.data?.length ?? 0} shared resources</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> New note
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={createNote}>
              <DialogHeader>
                <DialogTitle>Add a lecture note</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="note-title">Title</Label>
                  <Input
                    id="note-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Week 4 — Reaction mechanisms"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note-body">Notes / transcript</Label>
                  <Textarea
                    id="note-body"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={6}
                    placeholder="Paste or type your notes…"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note-audio">Lecture audio (optional, max 50MB)</Label>
                  <Input
                    id="note-audio"
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy || !title.trim()}>
                  {busy ? "Saving…" : "Save note"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {notes.isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : notes.data?.length ? (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {notes.data.map((note) => (
            <Card key={note.id} className="min-w-0 gap-3 border-border shadow-card transition-shadow hover:shadow-lift">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="mb-3 grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">{note.audio_url ? <FileAudio className="size-5" /> : <FileText className="size-5" />}</span>
                    <CardTitle className="display text-lg">
                      <Button
                        variant="link"
                        className="h-auto max-w-full justify-start whitespace-normal p-0 text-left font-serif text-lg text-foreground"
                        onClick={() => setViewingId(note.id)}
                      >
                        {note.title}
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      {new Date(note.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {note.audio_url ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Play audio"
                          onClick={() => { if (note.audio_url) void togglePlayer(note.id, note.audio_url); }}
                        >
                          <FileAudio className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Transcribe audio"
                          disabled={transcribingId === note.id}
                          onClick={() => void transcribe(note)}
                        >
                          {transcribingId === note.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Sparkles className="size-4" />
                          )}
                        </Button>
                      </>
                    ) : null}
                    {note.transcript || note.summary ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Export as TXT"
                        onClick={() => exportNoteTxt(note)}
                      >
                        <FileText className="size-4" />
                      </Button>
                    ) : null}
                    {plan.exports.includes("pdf") && (note.transcript || note.summary) ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Export as PDF"
                        onClick={() => exportNotePdf(note)}
                      >
                        <Download className="size-4" />
                      </Button>
                    ) : null}
                    {note.created_by === userId ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete note"
                        onClick={() => void remove(note.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              {playerUrls[note.id] ? (
                <CardContent className="pb-2">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={playerUrls[note.id]} className="w-full" />
                </CardContent>
              ) : null}
              {note.transcript ? (
                <CardContent className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                  <p className="line-clamp-4">{note.transcript}</p>
                </CardContent>
              ) : null}
              {note.summary ? (
                <CardContent className="pt-0 text-sm">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Download className="size-3.5" /> Summary
                  </span>
                  <p className="line-clamp-3 break-words text-muted-foreground">{note.summary}</p>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 border-y border-dashed border-border py-16 text-center">
          <span className="grid size-14 place-items-center rounded-lg bg-accent text-accent-foreground"><FileText className="size-7" /></span>
          <h3 className="display text-xl font-semibold">Your shared library starts here</h3>
          <p className="text-sm text-muted-foreground">No notes or recordings yet.</p>
          <Button variant="outline" onClick={() => setOpen(true)}><Plus className="size-4" /> New note</Button>
        </div>
      )}

      <NoteViewer
        note={notes.data?.find((n) => n.id === viewingId) ?? null}
        userId={userId}
        onOpenChange={(o) => !o && setViewingId(null)}
      />
    </div>
  );
}
