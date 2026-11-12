import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { postAuthDestination, takePendingPlan } from "@/lib/auth-navigation";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Signing you in — Study Notes" },
      { name: "description", content: "Completing your Study Notes sign-in." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Signing you in — Study Notes" },
      { property: "og:description", content: "Completing your Study Notes sign-in." },
    ],
  }),
  component: AuthCallback,
});

/**
 * Resolves OAuth and email-confirmation redirects into a real session before
 * routing on. The Supabase client parses the URL fragment itself; we simply
 * wait for the session to land (or time out back to /auth).
 */
function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let done = false;

    const finish = (to: "/dashboard" | "/auth") => {
      if (done) return;
      done = true;
      if (to === "/dashboard") {
        sessionStorage.removeItem("study-notes:post-auth-next");
        // A paid plan chosen before Google sign-in continues to checkout.
        const pendingPlan = takePendingPlan();
        if (pendingPlan) {
          void navigate({ to: "/billing", search: { signup_plan: pendingPlan }, replace: true });
          return;
        }
      }
      void navigate({ to, replace: true });
    };


    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(postAuthDestination());
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(postAuthDestination());
    });

    const timeout = setTimeout(() => {
      if (!done) {
        setMessage("We couldn't complete that sign-in link. Redirecting…");
        finish("/auth");
      }
    }, 6000);

    return () => {
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/40 px-5 text-center">
      <div>
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
