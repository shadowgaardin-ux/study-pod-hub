import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Tier } from "@/lib/tiers";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  tier: Tier;
  tier_expires_at: string | null;
  created_at: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        queryClient.clear();
      }
      if (nextSession?.user) {
        // Deferred: never call other Supabase APIs inside the callback.
        setTimeout(() => {
          void fetchProfile(nextSession.user.id).then((p) => active && setProfile(p));
        }, 0);
      }
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        const p = await fetchProfile(data.session.user.id);
        if (active) setProfile(p);
      }
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile: async () => {
        if (!session?.user) return;
        setProfile(await fetchProfile(session.user.id));
      },
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
      },
    }),
    [session, profile, loading, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
