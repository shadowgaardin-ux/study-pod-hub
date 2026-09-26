import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export interface Flashcard {
  id: string;
  pod_id: string;
  deck_name: string;
  front: string;
  back: string;
  created_by: string;
  created_at: string;
}

type Rating = "easy" | "medium" | "hard";
const INTERVAL_DAYS: Record<Rating, number> = { hard: 0.007, medium: 1, easy: 4 };

function exportCards(cards: Flashcard[], kind: "txt" | "csv", name: string) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body =
    kind === "csv"
      ? ["front,back,deck", ...cards.map((c) => [c.front, c.back, c.deck_name].map(esc).join(","))].join("\n")
      : cards.map((c) => `${c.front.replace(/[\t\n]/g, " ")}\t${c.back.replace(/[\t\n]/g, " ")}`).join("\n");
  const blob = new Blob([body], { type: kind === "csv" ? "text/csv" : "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^a-z0-9]+/gi, "-")}.${kind}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function FlipCard({
  card,
  canDelete,
  onDelete,
  rating,
  onRate,
}: {
  card: Flashcard;
  canDelete: boolean;
  onDelete: () => void;
  rating?: Rating | undefined;
  onRate: (r: Rating) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  return (
    <Card
      className="cursor-pointer select-none transition-shadow hover:shadow-md"
      onClick={() => setFlipped((f) => !f)}
    >
      <CardContent className="flex min-h-32 flex-col justify-between gap-3 p-5">
        <p className="text-sm leading-relaxed">
          {flipped ? card.back : card.front}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <RotateCw className="size-3" /> {flipped ? "Answer" : "Question"}
          </span>
          {canDelete ? (
            <button
              aria-label="Delete card"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
        {flipped ? (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {(["hard", "medium", "easy"] as Rating[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={rating === r ? "default" : "outline"}
                className="flex-1 capitalize"
                onClick={() => { onRate(r); setFlipped(false); }}
              >
                {r}
              </Button>
            ))}
          </div>
        ) : rating ? (
          <Badge variant="secondary" className="w-fit capitalize">Mastery: {rating}</Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function FlashcardsTab({ podId, userId }: { podId: string; userId: string | undefined }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deck, setDeck] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [busy, setBusy] = useState(false);

  const cards = useQuery({
    queryKey: ["flashcards", podId],
    queryFn: async (): Promise<Flashcard[]> => {
      const { data, error } = await supabase
        .from("flashcards")
        .select("*")
        .eq("pod_id", podId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Flashcard[];
    },
  });

  const [dueOnly, setDueOnly] = useState(false);
  const reviews = useQuery({
    queryKey: ["flashcard_reviews", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcard_reviews")
        .select("card_id, rating, due_at");
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.card_id, r as { rating: Rating; due_at: string }]));
    },
  });

  async function rate(cardId: string, rating: Rating) {
    if (!userId) return;
    const due = new Date(Date.now() + INTERVAL_DAYS[rating] * 86400000).toISOString();
    const { error } = await supabase
      .from("flashcard_reviews")
      .upsert({ card_id: cardId, user_id: userId, rating, due_at: due }, { onConflict: "card_id,user_id" });
    if (error) { toast.error(error.message); return; }
    await queryClient.invalidateQueries({ queryKey: ["flashcard_reviews", userId] });
  }

  const now = Date.now();
  const isDue = (id: string) => {
    const r = reviews.data?.get(id);
    return !r || new Date(r.due_at).getTime() <= now;
  };
  const dueCount = (cards.data ?? []).filter((c) => isDue(c.id)).length;

  const decks = new Map<string, Flashcard[]>();
  for (const card of (cards.data ?? []).filter((c) => !dueOnly || isDue(c.id))) {
    const list = decks.get(card.deck_name) ?? [];
    list.push(card);
    decks.set(card.deck_name, list);
  }

  async function addCard(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase.from("flashcards").insert({
      pod_id: podId,
      created_by: userId,
      deck_name: deck.trim() || "General",
      front: front.trim(),
      back: back.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Flashcard added");
    setFront("");
    setBack("");
    setOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["flashcards", podId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("flashcards").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["flashcards", podId] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant={dueOnly ? "default" : "outline"} onClick={() => setDueOnly((v) => !v)}>
          Study due ({dueCount})
        </Button>
        <Button variant="outline" disabled={!cards.data?.length} onClick={() => exportCards(cards.data ?? [], "txt", "flashcards-anki")}>
          <Download className="size-4" /> Anki (.txt)
        </Button>
        <Button variant="outline" disabled={!cards.data?.length} onClick={() => exportCards(cards.data ?? [], "csv", "flashcards-quizlet")}>
          <Download className="size-4" /> Quizlet (.csv)
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> New card
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={addCard}>
              <DialogHeader>
                <DialogTitle>Add a flashcard</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="deck">Deck</Label>
                  <Input
                    id="deck"
                    value={deck}
                    onChange={(e) => setDeck(e.target.value)}
                    placeholder="General"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="front">Front (question)</Label>
                  <Textarea
                    id="front"
                    value={front}
                    onChange={(e) => setFront(e.target.value)}
                    rows={3}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="back">Back (answer)</Label>
                  <Textarea
                    id="back"
                    value={back}
                    onChange={(e) => setBack(e.target.value)}
                    rows={3}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy || !front.trim() || !back.trim()}>
                  {busy ? "Saving…" : "Add card"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {cards.isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : decks.size ? (
        [...decks.entries()].map(([name, list]) => (
          <section key={name} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="display text-lg font-semibold">{name}</h3>
              <Badge variant="secondary">{list.length}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((card) => (
                <FlipCard
                  key={card.id}
                  card={card}
                  canDelete={card.created_by === userId}
                  onDelete={() => void remove(card.id)}
                  rating={reviews.data?.get(card.id)?.rating}
                  onRate={(r) => void rate(card.id, r)}
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="display text-lg">No flashcards yet</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Create cards to revise with your pod. Tap a card to flip it.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
