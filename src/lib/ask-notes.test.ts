import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { buildSections, pickSources } from "./ask-notes";

const notes = [
  { id: "a", title: "Lecture 1", transcript: "x".repeat(1000), summary: null },
  { id: "b", title: "Lecture 2", transcript: "", summary: null },
];

describe("ask my notes", () => {
  it("splits transcripts into citable sections and skips empty notes", () => {
    const s = buildSections(notes, 900);
    assert.deepEqual(s.map((x) => x.ref), ["S1.1", "S1.2"]);
    assert.equal(s[1]?.noteTitle, "Lecture 1");
  });
  it("only returns sources that exist in the user's notes", () => {
    const s = buildSections(notes, 900);
    assert.deepEqual(pickSources(s, ["S9.9", "S1.2", "S1.2"]).map((x) => x.ref), ["S1.2"]);
  });
});
