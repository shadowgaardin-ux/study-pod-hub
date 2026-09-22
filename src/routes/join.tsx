import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/join")({
  ssr: false,
  validateSearch: z.object({ code: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Join a study pod — Study Notes" },
      { name: "description", content: "Use an invite link or code to join a Study Notes pod." },
      { property: "og:title", content: "Join a study pod — Study Notes" },
      {
        property: "og:description",
        content: "Use an invite link or code to join a Study Notes pod.",
      },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useSearch();
  const { user, loading } = useAuth();
  const [value, setValue] = useState((code ?? "").toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function join(inviteCode: string) {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("join_pod_by_code", {
      _invite_code: inviteCode.trim().toUpperCase(),
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await queryClient.invalidateQueries();
    void navigate({ to: "/pod/$podId", params: { podId: data as string } });
  }

  useEffect(() => {
    if (loading || !user || !code) return;
    void join(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, code]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <BookOpen className="size-5" />
          </span>
          <CardTitle className="display text-2xl">Join a study pod</CardTitle>
          <CardDescription>
            {user
              ? "Enter the 6-character invite code from your classmate."
              : "Sign in first, then we'll add you to the pod."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="A1B2C3"
                className="text-center font-mono text-lg tracking-[0.4em] uppercase"
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button
                className="w-full"
                disabled={busy || value.trim().length < 4}
                onClick={() => void join(value)}
              >
                {busy ? "Joining…" : "Join pod"}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
            </>
          ) : (
            <Button asChild className="w-full">
              <Link to="/auth">Sign in to continue</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
