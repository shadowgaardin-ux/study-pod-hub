import { useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import type { PodWithCount } from "@/lib/queries";

const MAX_BYTES = 50 * 1024 * 1024;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AudioHub({
  pods,
  userId,
}: {
  pods: PodWithCount[] | undefined;
  userId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [podId, setPodId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activePod = podId || pods?.[0]?.id || "";

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  async function saveRecording(blob: Blob, filename: string) {
    if (!userId || !activePod) {
      toast.error("Pick a pod to save this recording to");
      return;
    }
    if (blob.size > MAX_BYTES) {
      toast.error("Recordings must be under 50MB");
      return;
    }
    setBusy(true);
    const path = `${activePod}/${crypto.randomUUID()}-${filename}`;
    const { error: uploadError } = await supabase.storage.from("pod-audio").upload(path, blob);
    if (uploadError) {
      setBusy(false);
      toast.error(uploadError.message);
      return;
    }
    const { error } = await supabase.from("notes").insert({
      pod_id: activePod,
      created_by: userId,
      title: title.trim() || `Recording ${new Date().toLocaleString()}`,
      audio_url: path,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved to your pod");
    setTitle("");
    await queryClient.invalidateQueries();
  }

  async function startRecording() {
    if (!activePod) {
      toast.error("Create or join a pod first");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void saveRecording(blob, "lecture.webm");
      };
      recorder.start();
      recorderRef.current = recorder;
      setElapsed(0);
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-accent/50 to-background">
      <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-end">
        <div className="grow space-y-2">
          <p className="display text-lg font-semibold">Audio capture hub</p>
          <p className="text-sm text-muted-foreground">
            Record the lecture live or drop in an existing file — it lands in your pod as a note.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={activePod} onValueChange={setPodId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a pod" />
              </SelectTrigger>
              <SelectContent>
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
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {recording && (
            <span className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive">
              <span className="size-2 animate-pulse rounded-full bg-destructive" />
              {formatTime(elapsed)}
            </span>
          )}
          <Button
            onClick={recording ? stopRecording : startRecording}
            disabled={busy}
            variant={recording ? "destructive" : "default"}
            className="gap-2"
          >
            {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
            {recording ? "Stop" : "Record"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" /> Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.pdf,.ppt,.pptx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void saveRecording(file, file.name);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
