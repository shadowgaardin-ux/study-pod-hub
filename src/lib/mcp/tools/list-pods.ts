import { ToolError, defineTool } from "@lovable.dev/mcp-js";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_pods",
  title: "List study pods",
  description: "List the study pods the signed-in user has joined or created.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("pods")
      .select("id, name, description, rules, is_public, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new ToolError(error.message);

    const pods = (data ?? []).map((pod) => ({
      id: pod.id,
      name: pod.name,
      description: pod.description ?? null,
      rules: pod.rules ?? null,
      isPublic: pod.is_public,
      createdAt: pod.created_at,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: pods.length
            ? pods.map((p) => `${p.name} (${p.id})`).join("\n")
            : "No pods yet.",
        },
      ],
      structuredContent: { pods },
    };
  },
});
