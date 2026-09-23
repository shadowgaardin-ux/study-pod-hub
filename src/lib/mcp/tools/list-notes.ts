import { ToolError, defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_notes",
  title: "List notes",
  description:
    "List notes and recordings the signed-in user can read, newest first. Optionally filter to one pod.",
  inputSchema: {
    podId: z.string().uuid().nullable().describe("Pod id to filter by, or null for all notes."),
    limit: z.number().int().min(1).max(100).nullable().describe("Max notes to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ podId, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("notes")
      .select("id, title, summary, transcript, pod_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (podId) query = query.eq("pod_id", podId);

    const { data, error } = await query;
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
          text: notes.length ? notes.map((n) => `${n.title} (${n.id})`).join("\n") : "No notes found.",
        },
      ],
      structuredContent: { notes },
    };
  },
});
