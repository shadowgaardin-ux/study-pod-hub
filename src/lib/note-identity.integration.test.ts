import { after, before, describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";

// Run with a temporary signed-in test session; never store a token in this file.
const url = process.env["TEST_BACKEND_URL"];
const key = process.env["TEST_BACKEND_KEY"];
const token = process.env["TEST_ACCESS_TOKEN"];

describe("note ownership and transcript persistence", { skip: !url || !key || !token }, () => {
  const client = createClient(url || "http://localhost", key || "unset", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  let noteId = "";
  let ownerId = "";

  before(async () => {
    const { data, error } = await client.auth.getUser(token);
    assert.equal(error, null);
    assert.ok(data.user);
    ownerId = data.user.id;
    const inserted = await client.from("notes").insert({
      title: "Temporary identity regression", created_by: ownerId,
    }).select("id").single();
    assert.equal(inserted.error, null);
    assert.ok(inserted.data);
    noteId = inserted.data.id;
  });

  after(async () => {
    if (!noteId) return;
    const { error } = await client.from("notes").delete().eq("id", noteId);
    assert.equal(error, null);
  });

  it("saves a transcript on the existing created_by schema", async () => {
    const { data, error } = await client.from("notes")
      .update({ transcript: "Lecture transcript saved successfully." })
      .eq("id", noteId).select("transcript, created_by").single();
    assert.equal(error, null);
    assert.equal(data?.transcript, "Lecture transcript saved successfully.");
    assert.equal(data?.created_by, ownerId);
  });

  it("rejects changing the author of an existing note", async () => {
    const { error } = await client.from("notes")
      .update({ created_by: "00000000-0000-4000-8000-000000000001" }).eq("id", noteId);
    assert.ok(error);
    const read = await client.from("notes").select("created_by").eq("id", noteId).single();
    assert.equal(read.error, null);
    assert.equal(read.data?.created_by, ownerId);
  });

  it("rejects rewriting the note creation date", async () => {
    const { error } = await client.from("notes")
      .update({ created_at: "2000-01-01T00:00:00Z" }).eq("id", noteId);
    assert.ok(error);
    assert.match(error.message, /Ownership cannot be changed/);
  });
});