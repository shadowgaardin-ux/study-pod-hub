import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Study Notes" },
      { name: "description", content: "Update your profile, avatar and appearance preferences." },
      { property: "og:title", content: "Settings — Study Notes" },
      { property: "og:description", content: "Update your profile, avatar and appearance preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
  }, [profile]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), avatar_url: avatarUrl.trim() || null })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Profile updated");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and appearance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="display text-lg">Profile</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ada Lovelace"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="avatar">Avatar URL</Label>
              <Input
                id="avatar"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="display text-lg">Appearance</CardTitle>
          <CardDescription>Switch between light and dark mode.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>
    </div>
  );
}
