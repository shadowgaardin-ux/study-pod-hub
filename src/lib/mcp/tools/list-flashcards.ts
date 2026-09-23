import { ToolError, defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_flashcards",
  title: "List flashcards",
  description: "List flashcards the signed-in user can read, optionally filtered by deck name.",
  inputSchema: {
    deckName: z.string().trim().nullable().describe("Deck name to filter by, or null for all decks."),
    limit: z.number().int().min(1).max(200).nullable().describe("Max cards to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ deckName, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("flashcards")
      .select("id, deck_name, front, back, pod_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (deckName) query = query.eq("deck_name", deckName);

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    const cards = (data ?? []).map((card) => ({
      id: card.id,
      deckName: card.deck_name,
      front: card.front,
      back: card.back,
      podId: card.pod_id ?? null,
      createdAt: card.created_at,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: cards.length
            ? cards.map((c) => `[${c.deckName}] ${c.front} → ${c.back}`).join("\n")
            : "No flashcards found.",
        },
      ],
      structuredContent: { cards },
    };
  },
});
