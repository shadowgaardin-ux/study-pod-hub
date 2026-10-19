import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileAudio, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { exportNotePdf, exportNoteTxt } from "@/lib/export-note";
import { planFor } from "@/lib/tiers";
import { transcribeNote } from "@/lib/transcribe.functions";

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
      if (file.size > 50 * 1024 * 1024) {
        setBusy(false);
        toast.error("Audio files must be under 50MB");
        return;
      }
      const path = `${userId}/${podId}/${crypto.randomUUID()}-${file.name}`;
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
    const { data, error } = await supabase.storage.from("pod-audio").createSignedUrl(path, 3600);
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
      <div className="flex justify-end">
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
        <div className="grid gap-4">
          {notes.data.map((note) => (
            <Card key={note.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="display text-lg">{note.title}</CardTitle>
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
                          onClick={() => void togglePlayer(note.id, note.audio_url!)}
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
                <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {note.transcript}
                </CardContent>
              ) : null}
              {note.summary ? (
                <CardContent className="pt-0 text-sm">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Download className="size-3.5" /> Summary
                  </span>
                  <p className="text-muted-foreground">{note.summary}</p>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No notes yet. Add the first lecture note for this pod.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
