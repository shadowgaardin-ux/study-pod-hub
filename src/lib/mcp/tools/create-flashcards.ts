import { ToolError, defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_flashcards",
  title: "Create flashcards",
  description:
    "Add one or more flashcards to a deck in the signed-in user's library, or inside a pod.",
  inputSchema: {
    deckName: z.string().trim().min(1).describe("Deck the cards belong to."),
    podId: z.string().uuid().nullable().describe("Pod id to save into, or null for personal library."),
    cards: z
      .array(z.object({ front: z.string().trim().min(1), back: z.string().trim().min(1) }))
      .describe("Cards to create, each with a front and a back."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ deckName, podId, cards }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Could not resolve the signed-in user");
    if (cards.length === 0) throw new ToolError("Provide at least one card");

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("flashcards")
      .insert(
        cards.map((card) => ({
          deck_name: deckName,
          front: card.front,
          back: card.back,
          pod_id: podId,
          created_by: userId,
        })),
      )
      .select("id, deck_name, front, back");
    if (error) throw new ToolError(error.message);

    const created = (data ?? []).map((card) => ({
      id: card.id,
      deckName: card.deck_name,
      front: card.front,
      back: card.back,
    }));

    return {
      content: [
        { type: "text" as const, text: `Added ${created.length} card(s) to "${deckName}".` },
      ],
      structuredContent: { cards: created },
    };
  },
});
