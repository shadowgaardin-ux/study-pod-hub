import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface Pod {
  id: string;
  name: string;
  course_code: string;
  invite_code: string | null;
  created_by: string;
  created_at: string;
}

export interface PodWithCount extends Pod {
  member_count: number;
}

export interface PodMemberProfile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
}

export function usePods(userId: string | undefined) {
  return useQuery({
    queryKey: ["pods", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PodWithCount[]> => {
      const { data, error } = await supabase
        .from("pods")
        .select("*, pod_members(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const { pod_members, ...pod } = row as Pod & {
          pod_members: { count: number }[] | null;
        };
        return { ...pod, member_count: pod_members?.[0]?.count ?? 1 };
      });
    },
  });
}

export function usePod(podId: string) {
  return useQuery({
    queryKey: ["pod", podId],
    queryFn: async (): Promise<Pod> => {
      const { data, error } = await supabase.from("pods").select("*").eq("id", podId).single();
      if (error) throw error;
      return data as Pod;
    },
  });
}

export function usePodMembers(podId: string) {
  return useQuery({
    queryKey: ["pod-members", podId],
    queryFn: async (): Promise<PodMemberProfile[]> => {
      const { data, error } = await supabase.rpc("pod_member_profiles", { _pod_id: podId });
      if (error) throw error;
      return (data ?? []) as PodMemberProfile[];
    },
  });
}

/** Usage counters used by the tier meter on the dashboard. */
export function useUsage(userId: string | undefined) {
  return useQuery({
    queryKey: ["usage", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [pods, notes, cards] = await Promise.all([
        supabase.from("pod_members").select("id", { count: "exact", head: true }),
        supabase
          .from("notes")
          .select("id", { count: "exact", head: true })
          .eq("created_by", userId!),
        supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("created_by", userId!),
      ]);
      return {
        pods: pods.count ?? 0,
        notes: notes.count ?? 0,
        flashcards: cards.count ?? 0,
      };
    },
  });
}

export function initials(name: string | null | undefined, fallback = "?") {
  if (!name) return fallback;
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
