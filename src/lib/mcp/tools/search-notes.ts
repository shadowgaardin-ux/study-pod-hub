import { ToolError, defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_notes",
  title: "Search notes",
  description: "Search the signed-in user's readable notes by title, summary or transcript text.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Text to search for."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const pattern = `%${query.replace(/[%_]/g, "")}%`;
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, summary, transcript, pod_id, created_at")
      .or(`title.ilike.${pattern},summary.ilike.${pattern},transcript.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new ToolError(error.message);

    const notes = (data ?? []).map((note) => ({
      id: note.id,
      title: note.title,
      summary: note.summary ?? null,
      transcript: note.transcript ?? null,
      podId: note.pod_id ?? null,
      createdAt: note.created_at,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: notes.length
            ? notes.map((n) => `${n.title} (${n.id})`).join("\n")
            : `No notes matched "${query}".`,
        },
      ],
      structuredContent: { notes },
    };
  },
});
