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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const RULES_PLACEHOLDER = "No off-topic posts\nCourse materials only\nBe kind in chat";

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
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("pods")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        rules: rules.trim() || null,
        created_by: userId,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pod created");
    setName("");
    setDescription("");
    setRules("");
    onOpenChange(false);
    await queryClient.invalidateQueries();
    void navigate({ to: "/pod/$podId", params: { podId: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="display">Create a study pod</DialogTitle>
            <DialogDescription>
              A shared space for your group. You'll get an invite link to share right after.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pod-name">Pod title</Label>
              <Input
                id="pod-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Organic Chemistry crew"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pod-description">Short description</Label>
              <Textarea
                id="pod-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Weekly revision for second-semester organic chemistry."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pod-rules">Group rules / guidelines</Label>
              <Textarea
                id="pod-rules"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={3}
                placeholder={RULES_PLACEHOLDER}
              />
              <p className="text-xs text-muted-foreground">
                One rule per line — shown pinned at the top of the pod.
              </p>
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
            <DialogTitle className="display">Join a pod</DialogTitle>
            <DialogDescription>
              Paste the 6-character invite code from a classmate's link.
            </DialogDescription>
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
