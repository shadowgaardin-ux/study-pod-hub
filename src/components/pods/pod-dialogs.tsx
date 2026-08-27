import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export function CreatePodDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | undefined;
}) {
  const [name, setName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("pods")
      .insert({ name: name.trim(), course_code: courseCode.trim(), created_by: userId })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pod created");
    setName("");
    setCourseCode("");
    onOpenChange(false);
    await queryClient.invalidateQueries();
    void navigate({ to: "/pod/$podId", params: { podId: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Create a study pod</DialogTitle>
            <DialogDescription>
              Pods are shared workspaces for a course. You'll get an invite code to share.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pod-name">Pod name</Label>
              <Input
                id="pod-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Organic Chemistry crew"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pod-course">Course code</Label>
              <Input
                id="pod-course"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="CHM 201"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create pod"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function JoinPodDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("join_pod_by_code", {
      _invite_code: code.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Joined pod");
    setCode("");
    onOpenChange(false);
    await queryClient.invalidateQueries();
    void navigate({ to: "/pod/$podId", params: { podId: data as string } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Join a pod</DialogTitle>
            <DialogDescription>Enter the 6-character invite code from a classmate.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="invite-code">Invite code</Label>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A1B2C3"
              maxLength={6}
              className="font-mono tracking-[0.3em] uppercase"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || code.trim().length < 4}>
              {busy ? "Joining…" : "Join pod"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
