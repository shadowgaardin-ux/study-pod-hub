import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, HelpCircle, KeyRound, List, Loader2, Save, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { studyAction } from "@/lib/ai.functions";
import { exportNoteTxt } from "@/lib/export-note";
import { transcribeNote } from "@/lib/transcribe.functions";

export interface ViewableNote {
  id: string;
  title: string;
  audio_url: string | null;
  transcript: string | null;
  summary: string | null;
  created_at: string;
  created_by: string;
}

type Action = "bullets" | "terms" | "quiz";
const ACTIONS: { key: Action; label: string; icon: typeof List }[] = [
  { key: "bullets", label: "Bullet points", icon: List },
  { key: "terms", label: "Key terms", icon: KeyRound },
  { key: "quiz", label: "Quiz questions", icon: HelpCircle },
];

const AUDIO_EXT = ["mp3", "wav", "m4a", "ogg", "webm", "mp4", "aac"];

export function NoteViewer({
  note,
  userId,
  onOpenChange,
}: {
  note: ViewableNote | null;
  userId: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const runTranscribe = useServerFn(transcribeNote);
  const runAi = useServerFn(studyAction);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const canEdit = Boolean(note && userId && note.created_by === userId);
  const isAudio = Boolean(
    note?.audio_url && AUDIO_EXT.includes(note.audio_url.split(".").pop()?.toLowerCase() ?? ""),
  );

  useEffect(() => {
    setText(note?.transcript ?? "");
    setSavedText(note?.transcript ?? "");
    setResults([]);
    setAction(null);
    setAudioUrl(null);
    if (!note?.audio_url || !isAudio) return;
    let cancelled = false;
    void supabase.storage
      .from("pod-audio")
      .createSignedUrl(note.audio_url, 120)
      .then(({ data }) => {
        if (!cancelled && data) setAudioUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
    // Re-run only when a different note is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  async function save() {
    if (!note) return;
    setSaving(true);
    const { error } = await supabase
      .from("notes")
      .update({ transcript: text.trim() || null })
      .eq("id", note.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavedText(text);
    toast.success("Transcript saved");
    await queryClient.invalidateQueries();
  }

  async function transcribe() {
    if (!note?.audio_url) return;
    setTranscribing(true);
    try {
      const res = await runTranscribe({ data: { noteId: note.id, audioPath: note.audio_url } });
      setText(res.transcript);
      setSavedText(res.transcript);
      toast.success("Transcript ready");
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  async function runAction(key: Action) {
    const source = [note?.summary, text].filter(Boolean).join("\n\n").trim();
    if (!source) return;
    setAction(key);
    setResults([]);
    setAiBusy(true);
    try {
      const res = await runAi({ data: { action: key, text: source.slice(0, 60000) } });
      setResults(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setAiBusy(false);
    }
  }

  const dirty = text !== savedText;

  return (
    <Sheet open={note !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="display pr-6">{note?.title}</SheetTitle>
          <SheetDescription>
            {note ? new Date(note.created_at).toLocaleString() : null}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8">
          {isAudio ? (
            audioUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio controls src={audioUrl} className="w-full" />
            ) : (
              <p className="text-sm text-muted-foreground">Loading audio…</p>
            )
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Transcript</h3>
              {isAudio ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  disabled={transcribing || !canEdit}
                  onClick={() => void transcribe()}
                >
                  {transcribing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {savedText ? "Re-transcribe" : "Transcribe"}
                </Button>
              ) : null}
            </div>
            {transcribing ? (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Transcribing your recording — this can take up to a minute…
              </p>
            ) : (
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                readOnly={!canEdit}
                rows={12}
                placeholder={
                  isAudio
                    ? "No transcript yet — tap Transcribe, or type your notes here."
                    : "Type your notes here."
                }
              />
            )}
            <div className="flex gap-2">
              {canEdit ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!dirty || saving}
                  onClick={() => void save()}
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Save changes
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={!text.trim() && !note?.summary}
                onClick={() => note && exportNoteTxt({ ...note, transcript: text })}
              >
                <FileText className="size-3.5" /> Export TXT
              </Button>
            </div>
          </div>

          {note?.summary ? (
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Summary</h3>
              <p className="text-sm text-muted-foreground">{note.summary}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="size-4 text-primary" /> Ask AI about this note
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {ACTIONS.map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  size="sm"
                  variant={action === key ? "default" : "outline"}
                  className="gap-1.5"
                  disabled={aiBusy || (!text.trim() && !note?.summary)}
                  onClick={() => void runAction(key)}
                >
                  {aiBusy && action === key ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                  <span className="truncate">{label}</span>
                </Button>
              ))}
            </div>
            {results.length > 0 ? (
              <ul className="space-y-2 rounded-lg border border-border p-4 text-sm">
                {results.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
