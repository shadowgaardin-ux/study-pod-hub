import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Mic, Square, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
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
import { UNLIMITED, planFor } from "@/lib/tiers";

const PERSONAL = "personal";

/** Browser speech recognition (Chrome/Edge). */
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
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
    | (new () => SpeechRecognitionInstance)
    | null;
}

export function AudioHub({
  pods,
  userId,
}: {
  pods: PodWithCount[] | undefined;
  userId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const plan = planFor(profile?.tier);
  const usage = useUsage(userId);
  const [target, setTarget] = useState<string>(PERSONAL);
  const [title, setTitle] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [recovered, setRecovered] = useState<{ sessionId: string; size: number } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const sessionRef = useRef<string>("");
  const indexRef = useRef(0);
  const transcriptRef = useRef("");
  const pendingWrites = useRef<Promise<unknown>[]>([]);
  const [interim, setInterim] = useState("");

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
      toast.info(`Your ${plan.tier} plan allows up to ${plan.maxRecordingMinutes} minutes per recording — stopping and saving now.`);
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, recording, maxSeconds]);

  // A recording interrupted by a reload or network drop is still in IndexedDB.
  useEffect(() => {
    void listBufferedSessions().then((sessions) => {
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
    }).catch(() => undefined);
  }, []);

  /** Returns true only when both the file and the note were saved. */
  async function saveBlob(blob: Blob, filename: string, transcriptText?: string): Promise<boolean> {
    if (!userId) return false;
    setBusy(true);
    const podId = target === PERSONAL ? null : target;
    const folder = podId ?? userId;
    const path = `${folder}/${crypto.randomUUID()}-${filename}`;
    const { error: uploadError } = await supabase.storage.from("pod-audio").upload(path, blob);
    if (uploadError) {
      setBusy(false);
      toast.error(`Upload failed — your recording is kept on this device. ${uploadError.message}`);
      return false;
    }
    const { error } = await supabase.from("notes").insert({
      pod_id: podId,
      created_by: userId,
      title: title.trim() || `Recording ${new Date().toLocaleString()}`,
      audio_url: path,
      transcript: transcriptText?.trim() || null,
    });
    setBusy(false);
    if (error) {
      await supabase.storage.from("pod-audio").remove([path]);
      toast.error(`Could not save the note — your recording is kept on this device. ${error.message}`);
      return false;
    }
    toast.success(podId ? "Saved to your pod" : "Saved to your personal library");
    setTitle("");
    transcriptRef.current = "";
    setLiveTranscript("");
    await queryClient.invalidateQueries();
    return true;
  }

  function startRecognition() {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let pending = "";
      let next = transcriptRef.current;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (result.isFinal) {
          next = `${next}${next && !next.endsWith(" ") ? " " : ""}${result[0].transcript.trim()}`;
        } else {
          pending += result[0].transcript;
        }
      }
      if (next !== transcriptRef.current) updateTranscript(next);
      setInterim(pending.trim());
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
    if (atRecordingLimit) {
      toast.error(
        `Your ${plan.tier} plan allows ${plan.maxRecordings} saved recordings. Delete older recordings or upgrade to record more.`,
      );
      return;
    }
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
          if (!blob) return;
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
          setRecovered({ sessionId, size: 0 });
          toast.error("Saving failed — your recording is kept on this device. Try “Save it” again.");
        }
      };
      // 5-second slices so an interruption loses at most a few seconds.
      recorder.start(5000);
      recorderRef.current = recorder;
      setElapsed(0);
      setRecording(true);
      startRecognition();
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
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
    <Card className="border-primary/25 bg-gradient-to-br from-accent/50 to-background">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="grow space-y-2">
            <p className="display text-lg font-semibold">Audio capture hub</p>
            <p className="text-sm text-muted-foreground">
              Record the lecture live or drop in a file. It saves to your private library by default —
              share it to a pod whenever you're ready.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
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
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Recording title (optional)"
              />
            </div>
            <p className="text-xs text-muted-foreground">{UPLOAD_HINT}</p>
            <p className="text-xs text-muted-foreground">
              {plan.tier} plan: up to {plan.maxRecordingMinutes >= 60
                ? `${plan.maxRecordingMinutes / 60} hour${plan.maxRecordingMinutes > 60 ? "s" : ""}`
                : `${plan.maxRecordingMinutes} minutes`}{" "}
              per recording ·{" "}
              {plan.maxRecordings === UNLIMITED
                ? "unlimited saved recordings"
                : `${recordingsUsed} of ${plan.maxRecordings} recordings used`}
            </p>
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
                <Button size="sm" variant="secondary" onClick={() => void recoverSession()}>
                  Save it
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
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
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {recording && (
              <span className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive">
                <span className="size-2 animate-pulse rounded-full bg-destructive" />
                {formatTimer(elapsed)}
                <span className="text-xs font-normal">
                  · {formatTimer(remaining)} left
                </span>
              </span>
            )}
            <Button
              onClick={recording ? stopRecording : () => void startRecording()}
              disabled={busy || (!recording && atRecordingLimit)}
              variant={recording ? "destructive" : "default"}
              className="gap-2"
            >
              {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
              {recording ? "Stop" : "Record"}
            </Button>
            <Button variant="outline" className="gap-2" disabled={busy} asChild>
              <label className="cursor-pointer">
                <Upload className="size-4" /> Upload
                <input
                  type="file"
                  accept={UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const problem = validateUpload(file);
                    if (problem) {
                      toast.error(problem);
                      return;
                    }
                    void saveBlob(file, file.name);
                  }}
                />
              </label>
            </Button>
          </div>
        </div>

        {(recording || liveTranscript) && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Live transcript — edit any mistakes before saving
            </p>
            <Textarea
              value={liveTranscript}
              onChange={(e) => updateTranscript(e.target.value)}
              rows={5}
              placeholder={
                recording
                  ? "Listening… your words will appear here as you speak."
                  : "Your transcript appears here. Edit it, then save."
              }
              className="bg-background"
            />
            {interim ? (
              <p className="text-sm italic text-muted-foreground">{interim}…</p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
