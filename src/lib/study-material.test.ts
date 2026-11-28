import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { questionSchema, quizSchema, studyScopeSchema, studySource, reviewDueAt } from "./study-material";
import { sharedEditSchema, shareTokenSchema } from "./note-sharing";

const mc = { type: "multiple_choice", question: "What is ATP?", options: ["Energy carrier", "Cell", "Tissue", "Organ"], answer: 0, explanation: "From the lecture." };
const tf = { type: "true_false", question: "ATP transfers energy.", options: ["True", "False"], answer: 0, explanation: "From the lecture." };
describe("lecture and course practice", () => {
  it("requires an unambiguous lecture or semester/course scope", () => {
    assert.equal(studyScopeSchema.safeParse({ noteId: "00000000-0000-4000-8000-000000000001", course: "Biology" }).success, false);
    assert.equal(studyScopeSchema.safeParse({ semester: "Autumn", course: "Biology" }).success, true);
  });
  it("includes transcripts and summaries from each course lecture", () => {
    const source = studySource([{ title: "Lecture 1", transcript: "ATP transfers energy", summary: "Cell energy" }, { title: "Lecture 2", transcript: "DNA stores information", summary: null }]);
    assert.ok(source.includes("ATP transfers energy")); assert.ok(source.includes("Cell energy")); assert.ok(source.includes("DNA stores information"));
    assert.throws(() => studySource([{ title: "Empty", transcript: null, summary: null }]));
  });
  it("requires multiple-choice and true/false questions", () => {
    assert.equal(quizSchema.safeParse({ questions: [mc, tf] }).success, true);
    assert.equal(quizSchema.safeParse({ questions: [mc, mc] }).success, false);
  });
  it("rejects out-of-range answers and malformed true/false options", () => {
    assert.equal(questionSchema.safeParse({ ...mc, answer: 4 }).success, false);
    assert.equal(questionSchema.safeParse({ ...tf, options: ["Yes", "No"] }).success, false);
  });
  it("preserves existing hard, medium and easy review intervals", () => {
    assert.equal(reviewDueAt("medium", 0), "1970-01-02T00:00:00.000Z");
    assert.equal(reviewDueAt("easy", 0), "1970-01-05T00:00:00.000Z");
    assert.equal(reviewDueAt("hard", 0), "1970-01-01T00:10:04.800Z");
  });
});
describe("public note links", () => {
  it("accepts only high-entropy capability tokens", () => {
    assert.equal(shareTokenSchema.safeParse("a".repeat(64)).success, true);
    assert.equal(shareTokenSchema.safeParse("guessable").success, false);
  });
  it("public edits accept only content, never ownership, files or course reassignment", () => {
    const edit = { token: "a".repeat(64), title: "Shared lecture", transcript: "ATP", summary: null, version: "b".repeat(32) };
    assert.equal(sharedEditSchema.safeParse(edit).success, true);
    for (const field of ["created_by", "audio_url", "pod_id", "semester", "course"]) assert.equal(sharedEditSchema.safeParse({ ...edit, [field]: "changed" }).success, false);
  });
});