import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Loader2, Mic, Square, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AiAudioVisual } from "@/components/dashboard/ai-audio-visual";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NoteViewer, type ViewableNote } from "@/components/notes/note-viewer";
import { CourseOrganizationFields } from "@/components/notes/course-organization-fields";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { transcribeNote } from "@/lib/transcribe.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  COMPRESSED_BITRATE,
  RECORD_CONSTRAINTS,
  UPLOAD_ACCEPT,
  UPLOAD_HINT,
  assembleSession,
  bufferChunk,
  clearSession,
  formatBytes,
  formatTimer,
  listBufferedSessions,
  pickMimeType,
  validateUpload,
} from "@/lib/audio";
import { useUsage, type PodWithCount } from "@/lib/queries";
import { usePersonalNotes } from "@/lib/library";
import { cleanOrganizationLabel, organizationSuggestions } from "@/lib/course-organization";
import { UNLIMITED, planFor } from "@/lib/tiers";

const PERSONAL = "personal";

/** Browser speech recognition (Chrome/Edge). */
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror?: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string } }[];
};

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as
    (new () => SpeechRecognitionInstance) | null;
}

export function AudioHub({
  pods,
  userId,
  focus = false,
}: {
  pods: PodWithCount[] | undefined;
  userId: string | undefined;
  focus?: boolean;
}) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const plan = planFor(profile?.tier);
  const usage = useUsage(userId);
  const personalNotes = usePersonalNotes(userId);
  const semesterOptions = organizationSuggestions(personalNotes.data ?? [], "semester");
  const courseOptions = organizationSuggestions(personalNotes.data ?? [], "course");
  const [target, setTarget] = useState<string>(PERSONAL);
  const [title, setTitle] = useState("");
  const [semester, setSemester] = useState("");
  const [course, setCourse] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<
    "idle" | "starting" | "saving" | "processing" | "ready" | "error"
  >("idle");
  const [statusError, setStatusError] = useState("");
  const [savedNote, setSavedNote] = useState<ViewableNote | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [recovered, setRecovered] = useState<{ sessionId: string; size: number } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const sessionRef = useRef<string>("");
  const indexRef = useRef(0);
  const transcriptRef = useRef("");
  const pendingWrites = useRef<Promise<unknown>[]>([]);
  const [interim, setInterim] = useState("");
  const runTranscribe = useServerFn(transcribeNote);

  function updateTranscript(text: string) {
    transcriptRef.current = text;
    setLiveTranscript(text);
    if (sessionRef.current) {
      try {
        localStorage.setItem(`transcript:${sessionRef.current}`, text);
      } catch {
        /* storage full or blocked */
      }
    }
  }

  const maxSeconds = plan.maxRecordingMinutes * 60;
  const remaining = Math.max(0, maxSeconds - elapsed);
  const recordingsUsed = usage.data?.recordings ?? 0;
  const atRecordingLimit = plan.maxRecordings !== UNLIMITED && recordingsUsed >= plan.maxRecordings;

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  // Auto-stop when the plan's max recording length is reached.
  useEffect(() => {
    if (recording && elapsed >= maxSeconds) {
      toast.info(
        `Your ${plan.tier} plan allows up to ${plan.maxRecordingMinutes} minutes per recording — stopping and saving now.`,
      );
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, recording, maxSeconds]);

  // A recording interrupted by a reload or network drop is still in IndexedDB.
  useEffect(() => {
    if (!userId) return;
    void listBufferedSessions(userId)
      .then((sessions) => {
        const latest = sessions[0];
        if (latest) {
          sessionRef.current = latest.sessionId;
          setRecovered({ sessionId: latest.sessionId, size: latest.size });
          const saved = localStorage.getItem(`transcript:${latest.sessionId}`);
          if (saved) {
            transcriptRef.current = saved;
            setLiveTranscript(saved);
          }
        }
      })
      .catch(() => undefined);
  }, [userId]);

  /** Returns true only when both the file and the note were saved. */
  async function saveBlob(blob: Blob, filename: string, transcriptText?: string): Promise<boolean> {
    if (!userId) return false;
    setBusy(true);
    setPhase("saving");
    setStatusError("");
    setSavedNote(null);
    const podId = target === PERSONAL ? null : target;
    const folder = podId ? `${podId}/${userId}` : userId;
    const path = `${folder}/${crypto.randomUUID()}-${filename}`;
    const { error: uploadError } = await supabase.storage.from("pod-audio").upload(path, blob);
    if (uploadError) {
      setBusy(false);
      setPhase("error");
      setStatusError("Couldn’t save audio. Try saving again before leaving this page.");
      toast.error(`Upload failed — your recording is kept on this device. ${uploadError.message}`);
      return false;
    }
    const { data: inserted, error } = await supabase
      .from("notes")
      .insert({
        pod_id: podId,
        created_by: userId,
        title: title.trim() || `Recording ${new Date().toLocaleString()}`,
        audio_url: path,
        transcript: transcriptText?.trim() || null,
        semester: cleanOrganizationLabel(semester),
        course: cleanOrganizationLabel(course),
      })
      .select("*")
      .single();
    if (error) {
      setBusy(false);
      setPhase("error");
      setStatusError(
        "Couldn’t save the note. Retry from your recording backup or upload the file again.",
      );
      await supabase.storage.from("pod-audio").remove([path]);
      toast.error(
        `Could not save the note — your recording is kept on this device. ${error.message}`,
      );
      return false;
    }
    toast.success(podId ? "Saved to your pod" : "Saved to your personal library");
    setSavedNote(inserted);
    setTitle("");
    transcriptRef.current = "";
    setLiveTranscript("");
    void queryClient.invalidateQueries();
    if (inserted && !transcriptText?.trim()) {
      setPhase("processing");
      toast.info("Transcribing your recording…");
      runTranscribe({ data: { noteId: inserted.id, audioPath: path } })
        .then(({ transcript }) => {
          setSavedNote({ ...inserted, transcript });
          setPhase("ready");
          toast.success("Transcript ready");
          void queryClient.invalidateQueries();
        })
        .catch((e: unknown) => {
          setPhase("error");
          const message = e instanceof Error ? e.message : "Transcription failed";
          setStatusError(`Audio saved. ${message} You can retry from your saved note.`);
          toast.error("Audio saved; transcription couldn’t finish", { description: message });
        })
        .finally(() => setBusy(false));
    } else {
      setPhase("ready");
      setBusy(false);
    }
    return true;
  }

  function startRecognition() {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      toast.info("Live words aren't supported in this browser — we'll transcribe after you stop.");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let pending = "";
      let next = transcriptRef.current;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        if (result.isFinal) {
          next = `${next}${next && !next.endsWith(" ") ? " " : ""}${result[0].transcript.trim()}`;
        } else {
          pending += result[0].transcript;
        }
      }
      if (next !== transcriptRef.current) updateTranscript(next);
      setInterim(pending.trim());
    };
    recognition.onerror = (event: { error?: string }) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      recognition.onend = null;
      toast.info("Live words stopped on this device — we'll transcribe after you stop.");
    };
    recognition.onend = () => {
      // Browser sometimes ends recognition mid-recording; restart while recording.
      if (recorderRef.current) {
        try {
          recognition.start();
        } catch {
          /* already started */
        }
      }
    };
    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      /* speech recognition unavailable */
    }
  }

  function stopRecognition() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) recognition.onend = null;
    recognition?.stop();
    setInterim("");
  }

  async function startRecording() {
    if (!userId || busy || recorderRef.current) return;
    if (atRecordingLimit) {
      toast.error(
        `Your ${plan.tier} plan allows ${plan.maxRecordings} saved recordings. Delete older recordings or upgrade to record more.`,
      );
      return;
    }
    setBusy(true);
    setPhase("starting");
    setStatusError("");
    setSavedNote(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(RECORD_CONSTRAINTS);
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: COMPRESSED_BITRATE,
      });
      const sessionId = crypto.randomUUID();
      sessionRef.current = sessionId;
      indexRef.current = 0;
      pendingWrites.current = [];
      updateTranscript("");
      const startedAt = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;
        const write = bufferChunk({
          sessionId,
          userId,
          index: indexRef.current++,
          startedAt,
          mimeType: recorder.mimeType || "audio/webm",
          blob: event.data,
        }).catch(() => toast.error("Could not back up part of the recording on this device"));
        pendingWrites.current.push(write);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        stopRecognition();
        try {
          // Wait for the final slice to reach the on-device backup.
          await Promise.all(pendingWrites.current);
          const blob = await assembleSession(sessionId);
          if (!blob) throw new Error("No recording data available");
          const ok = await saveBlob(blob, "lecture.webm", transcriptRef.current);
          if (ok) {
            await clearSession(sessionId);
            localStorage.removeItem(`transcript:${sessionId}`);
            setRecovered(null);
          } else {
            setRecovered({ sessionId, size: blob.size });
          }
        } catch {
          setBusy(false);
          setPhase("error");
          setStatusError("Saving failed. Your recording backup has been kept — try Save it again.");
          setRecovered({ sessionId, size: 0 });
          toast.error(
            "Saving failed — your recording is kept on this device. Try “Save it” again.",
          );
        }
      };
      // 5-second slices so an interruption loses at most a few seconds.
      recorder.start(5000);
      recorderRef.current = recorder;
      setElapsed(0);
      setRecording(true);
      setPhase("idle");
      setBusy(false);
      startRecognition();
    } catch {
      setPhase("error");
      setStatusError("Allow microphone access, then try recording again.");
      setBusy(false);
      toast.error("Microphone access denied");
    }
  }

  function stopRecording() {
    if (!recorderRef.current) return;
    setBusy(true);
    setPhase("saving");
    recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function recoverSession() {
    if (!recovered) return;
    const blob = await assembleSession(recovered.sessionId);
    if (!blob) {
      setRecovered(null);
      return;
    }
    const ok = await saveBlob(blob, "recovered-lecture.webm", transcriptRef.current);
    if (!ok) return;
    await clearSession(recovered.sessionId);
    localStorage.removeItem(`transcript:${recovered.sessionId}`);
    setRecovered(null);
  }

  return (
    <Card
      className={`relative overflow-hidden transition-shadow duration-300 ${focus ? "rounded-none border-0 bg-transparent bg-none! shadow-none" : `border-brand-sky/25 bg-card shadow-card ${recording ? "recording-glow" : ""}`}`}
    >
      <CardContent className={focus ? "flex flex-col gap-3 p-0" : "flex flex-col gap-5 p-5 sm:p-6"}>
        {focus && <AiAudioVisual recording={recording} />}
        <div className="flex flex-col gap-5">
          <details className="order-2 min-w-0 grow space-y-4 text-left">
            <summary className="mx-auto w-fit cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">
              Recording settings
            </summary>
            <div className="flex items-center gap-2">
              <span className={`icon-chip relative size-10 ${recording ? "mic-pulse" : ""}`}>
                <Mic className="size-5" />
              </span>
              <h2 className="text-lg font-semibold tracking-normal">Lecture recording</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger disabled={busy || recording} aria-label="Save recording to">
                  <SelectValue placeholder="Save to…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PERSONAL}>My personal library (private)</SelectItem>
                  {(pods ?? []).map((pod) => (
                    <SelectItem key={pod.id} value={pod.id}>
                      {pod.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={title}
                disabled={busy || recording}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Recording title (optional)"
              />
            </div>
            <CourseOrganizationFields
              semester={semester}
              course={course}
              semesters={semesterOptions}
              courses={courseOptions}
              disabled={busy || recording}
              onSemesterChange={setSemester}
              onCourseChange={setCourse}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {plan.tier} plan: up to{" "}
              {plan.maxRecordingMinutes >= 60
                ? `${plan.maxRecordingMinutes / 60} hour${plan.maxRecordingMinutes > 60 ? "s" : ""}`
                : `${plan.maxRecordingMinutes} minutes`}{" "}
              per recording ·{" "}
              {plan.maxRecordings === UNLIMITED
                ? "unlimited saved recordings"
                : `${recordingsUsed} of ${plan.maxRecordings} recordings used`}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">{UPLOAD_HINT}</p>
          </details>

          <div className="flex flex-col items-center gap-3">
            <div
              className="flex min-h-7 items-center justify-center gap-2 text-xs"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {recording ? (
                <span className="flex items-center gap-2 font-medium text-destructive">
                  <span className="size-2 rounded-full bg-destructive motion-safe:animate-pulse" />
                  Recording · {formatTimer(elapsed)}
                  <span className="font-normal text-muted-foreground">
                    · {formatTimer(remaining)} left
                  </span>
                </span>
              ) : phase === "starting" ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3.5 motion-safe:animate-spin" />
                  Connecting microphone…
                </span>
              ) : phase === "saving" ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3.5 motion-safe:animate-spin" />
                  Saving audio securely…
                </span>
              ) : phase === "processing" ? (
                <span className="flex items-center gap-2 text-brand-sky">
                  <Loader2 className="size-3.5 motion-safe:animate-spin" />
                  Processing · Audio saved
                </span>
              ) : phase === "ready" ? (
                <span className="flex items-center gap-2 font-medium text-brand-teal">
                  <Check className="size-3.5" />
                  Transcript Ready · Saved
                </span>
              ) : phase !== "error" ? (
                <span className="text-muted-foreground">
                  {target === PERSONAL
                    ? "Private · Saved to your library"
                    : "Shared · Saved to your pod"}
                </span>
              ) : null}
            </div>
            <div
              className="flex w-full max-w-80 items-stretch gap-1"
              role="group"
              aria-label="Record or upload audio"
            >
              <Button
                onClick={recording ? stopRecording : () => void startRecording()}
                data-tour={focus ? "record-button" : undefined}
                disabled={busy || (!recording && atRecordingLimit)}
                variant={recording ? "destructive" : "default"}
                className={`ai-record-button h-16 min-w-0 flex-1 gap-3 rounded-full px-5 text-base font-semibold ${recording ? "" : "bg-brand-gradient"}`}
              >
                {busy ? (
                  <Loader2 className="size-5 shrink-0 motion-safe:animate-spin" />
                ) : recording ? (
                  <Square className="size-5 shrink-0" />
                ) : (
                  <Mic className="size-5 shrink-0" />
                )}
                {phase === "starting"
                  ? "Connecting…"
                  : phase === "saving"
                    ? "Saving…"
                    : phase === "processing"
                      ? "Processing…"
                      : recording
                        ? "Stop & save"
                        : "Record with AI"}
              </Button>
              {!recording && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      disabled={busy}
                      className="h-16 w-14 shrink-0 rounded-full bg-brand-gradient px-0"
                      aria-label="Audio options"
                      title="Record or upload audio"
                    >
                      <ChevronDown className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      disabled={atRecordingLimit}
                      onSelect={() => void startRecording()}
                    >
                      <Mic />
                      Record lecture
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => uploadRef.current?.click()}>
                      <Upload />
                      Upload audio or resource
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <input
              ref={uploadRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              aria-label="Upload audio or resource"
              className="hidden"
              disabled={busy || recording}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file || busy || recording) return;
                const problem = validateUpload(file);
                if (problem) {
                  toast.error(problem);
                  return;
                }
                void saveBlob(file, file.name);
              }}
            />
            {phase === "error" && (
              <p role="alert" className="max-w-md text-center text-xs leading-5 text-destructive">
                {statusError}
              </p>
            )}
            {savedNote && (phase === "ready" || phase === "error") && (
              <Button variant="secondary" size="sm" onClick={() => setViewerOpen(true)}>
                {phase === "ready" ? "Open transcript" : "Open saved note"}
              </Button>
            )}
          </div>
        </div>

        {atRecordingLimit ? (
          <p className="text-xs font-medium text-destructive">
            You've reached your recording limit. Delete older recordings or{" "}
            <Link to="/billing" className="underline">
              upgrade your plan
            </Link>
            .
          </p>
        ) : null}
        {recovered && !recording ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs">
            <span>
              Unfinished recording found ({formatBytes(recovered.size)}) — it survived the
              interruption.
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void recoverSession()}
            >
              Save it
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (!window.confirm("Discard this recording permanently?")) return;
                void clearSession(recovered.sessionId);
                localStorage.removeItem(`transcript:${recovered.sessionId}`);
                updateTranscript("");
                setRecovered(null);
              }}
            >
              Discard
            </Button>
          </div>
        ) : null}

        {(recording || liveTranscript) && (
          <details className="space-y-2 text-left">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Live transcript
            </summary>
            <Textarea
              value={liveTranscript}
              onChange={(e) => updateTranscript(e.target.value)}
              rows={3}
              placeholder={
                recording
                  ? "Listening… your words will appear here as you speak."
                  : "Your transcript appears here. Edit it, then save."
              }
              className="bg-background"
            />
            {interim ? <p className="text-sm italic text-muted-foreground">{interim}…</p> : null}
          </details>
        )}
        <NoteViewer
          note={viewerOpen ? savedNote : null}
          userId={userId}
          semesters={semesterOptions}
          courses={courseOptions}
          onOpenChange={setViewerOpen}
        />
      </CardContent>
    </Card>
  );
}
