import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCw, Trash2 } from "lucide-react";
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

function FlipCard({
  card,
  canDelete,
  onDelete,
}: {
  card: Flashcard;
  canDelete: boolean;
  onDelete: () => void;
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

  const decks = new Map<string, Flashcard[]>();
  for (const card of cards.data ?? []) {
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
      <div className="flex justify-end">
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
