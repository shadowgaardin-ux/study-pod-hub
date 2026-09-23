import { ToolError, defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_note",
  title: "Create a note",
  description:
    "Create a note in the signed-in user's personal library, or inside a pod when a pod id is given.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Note title."),
    transcript: z.string().nullable().describe("Full note body or transcript, or null."),
    summary: z.string().nullable().describe("Short summary, or null."),
    podId: z.string().uuid().nullable().describe("Pod id to save into, or null for personal library."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, transcript, summary, podId }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Could not resolve the signed-in user");

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("notes")
      .insert({ title, transcript, summary, pod_id: podId, created_by: userId })
      .select("id, title, pod_id, created_at")
      .single();
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text" as const, text: `Created note "${data.title}" (${data.id}).` }],
      structuredContent: {
        note: {
          id: data.id,
          title: data.title,
          podId: data.pod_id ?? null,
          createdAt: data.created_at,
        },
      },
    };
  },
});
