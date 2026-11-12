import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { postAuthDestination, takePendingPlan } from "@/lib/auth-navigation";

/** Hosts served by Lovable, where the managed /~oauth broker exists. */
export function isLovableHost(hostname: string) {
  return (
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".lovableproject.com") ||
    hostname.endsWith(".lovable.dev") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  );
}

export function GoogleButton({
  label = "Continue with Google",
}: {
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleClick() {
    setLoading(true);
    sessionStorage.removeItem("study-notes:post-auth-next");

    // Off Lovable hosting (e.g. Vercel) the /~oauth broker route doesn't exist,
    // so go straight through the auth backend's own Google flow.
    if (!isLovableHost(window.location.hostname)) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        toast.error("Google sign-in failed", { description: error.message });
        setLoading(false);
      }
      return;
    }

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth/callback",
    });

    if (result.error) {
      toast.error("Google sign-in failed", { description: result.error.message });
      setLoading(false);
      return;
    }
    if (result.redirected) return;

    // Session already set by the helper (preview/popup flow).
    const pendingPlan = takePendingPlan();
    if (pendingPlan) {
      void navigate({ to: "/billing", search: { signup_plan: pendingPlan }, replace: true });
      return;
    }
    void navigate({ to: postAuthDestination(), replace: true });
  }


  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleClick} disabled={loading}>
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
        />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path
          fill="#EA4335"
          d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"
        />
      </svg>
      {loading ? "Connecting…" : label}
    </Button>
  );
}
