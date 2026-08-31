import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface LibraryNote {
  id: string;
  pod_id: string | null;
  created_by: string;
  title: string;
  audio_url: string | null;
  transcript: string | null;
  summary: string | null;
  created_at: string;
}

export interface LibraryCard {
  id: string;
  pod_id: string | null;
  deck_name: string;
  front: string;
  back: string;
  created_at: string;
}

/** Notes that live in the signed-in user's private library (no pod). */
export function usePersonalNotes(userId: string | undefined) {
  return useQuery({
    queryKey: ["personal-notes", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<LibraryNote[]> => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .is("pod_id", null)
        .eq("created_by", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LibraryNote[];
    },
  });
}

export function usePersonalCards(userId: string | undefined, noteTitle?: string) {
  return useQuery({
    queryKey: ["personal-cards", userId, noteTitle ?? null],
    enabled: Boolean(userId),
    queryFn: async (): Promise<LibraryCard[]> => {
      let query = supabase
        .from("flashcards")
        .select("*")
        .is("pod_id", null)
        .eq("created_by", userId!)
        .order("created_at", { ascending: false });
      if (noteTitle) query = query.eq("deck_name", noteTitle);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LibraryCard[];
    },
  });
}

export interface SearchResult {
  id: string;
  kind: "note" | "pod" | "deck";
  title: string;
  subtitle: string;
  podId: string | null;
}

/** Searches personal notes, transcripts, joined pods and flashcard decks. */
export function useGlobalSearch(term: string, userId: string | undefined) {
  const q = term.trim();
  return useQuery({
    queryKey: ["global-search", q, userId],
    enabled: Boolean(userId) && q.length >= 2,
    queryFn: async (): Promise<SearchResult[]> => {
      const like = `%${q}%`;
      const [notes, pods, cards] = await Promise.all([
        supabase
          .from("notes")
          .select("id, title, pod_id, transcript, summary")
          .or(`title.ilike.${like},transcript.ilike.${like},summary.ilike.${like}`)
          .limit(8),
        supabase.from("pods").select("id, name, description").ilike("name", like).limit(6),
        supabase
          .from("flashcards")
          .select("id, deck_name, front, pod_id")
          .or(`deck_name.ilike.${like},front.ilike.${like},back.ilike.${like}`)
          .limit(8),
      ]);

      const results: SearchResult[] = [];
      for (const note of notes.data ?? []) {
        results.push({
          id: note.id,
          kind: "note",
          title: note.title,
          subtitle: note.pod_id ? "Pod note" : "Private note",
          podId: note.pod_id,
        });
      }
      for (const pod of pods.data ?? []) {
        results.push({
          id: pod.id,
          kind: "pod",
          title: pod.name,
          subtitle: pod.description ?? "Study pod",
          podId: pod.id,
        });
      }
      const seenDecks = new Set<string>();
      for (const card of cards.data ?? []) {
        const key = `${card.pod_id ?? "me"}:${card.deck_name}`;
        if (seenDecks.has(key)) continue;
        seenDecks.add(key);
        results.push({
          id: card.id,
          kind: "deck",
          title: card.deck_name,
          subtitle: card.pod_id ? "Pod deck" : "Private deck",
          podId: card.pod_id,
        });
      }
      return results;
    },
  });
}
