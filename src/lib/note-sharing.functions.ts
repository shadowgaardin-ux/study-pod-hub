import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sharedEditSchema, shareTokenSchema } from "./note-sharing";

// Capability RPCs project only explicitly shared text; no admin key is needed on Vercel.
const publicClient = createServerOnlyFn(() => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Shared notes are temporarily unavailable.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
});

export const createNoteShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ noteId: z.string().uuid(), canEdit: z.boolean() }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await context.supabase.rpc("create_note_share", { _note_id: data.noteId, _token: token, _can_edit: data.canEdit });
    if (error) throw new Error("Couldn't share this note. Only its owner can create a link.");
    setResponseHeader("Cache-Control", "no-store");
    return { token };
  });

export const readSharedNote = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: shareTokenSchema }).strict().parse(d))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    setResponseHeader("Referrer-Policy", "no-referrer");
    const { data: rows, error } = await publicClient().rpc("read_shared_note", { _token: data.token });
    if (error) throw new Error("Couldn't open the shared note. Please try again.");
    return rows?.[0] ?? null;
  });

export const editSharedNote = createServerFn({ method: "POST" })
  .inputValidator((d) => sharedEditSchema.parse(d))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { error } = await publicClient().rpc("edit_shared_note", { _token: data.token, _title: data.title, _transcript: data.transcript ?? "", _summary: data.summary ?? "", _version: data.version });
    if (error) {
      if (error.message.includes("Reload before saving")) throw new Error("Someone changed this note. Reload before saving to avoid overwriting their changes.");
      throw new Error("Couldn't save. The owner may have revoked this link or disabled editing.");
    }
    return { saved: true };
  });