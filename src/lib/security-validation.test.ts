import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { isSafeFile, verifyNoteAudio } from "./security-validation";
import { CATALOG, validatePayment } from "./payment-validation";
import { safeCsvCell, searchPattern } from "./search-export-security";

describe("file and note security", () => {
  it("rejects executable and SVG files even with a spoofed image MIME", () => {
    assert.equal(isSafeFile("run.exe", "image/png", "image"), false);
    assert.equal(isSafeFile("active.svg", "image/svg+xml", "image"), false);
    assert.equal(isSafeFile("photo.png", "image/png", "image"), true);
  });
  it("does not transcribe a different file or another author's private note", () => {
    const note = { created_by: "owner", pod_id: null, audio_url: "owner/audio.webm" };
    assert.throws(() => verifyNoteAudio(note, "owner", "other/audio.webm", false));
    assert.throws(() => verifyNoteAudio(note, "other", note.audio_url, false));
    assert.doesNotThrow(() => verifyNoteAudio(note, "owner", note.audio_url, false));
  });
});
describe("verified payments", () => {
  const tx = { status: "success", reference: "ref", amount: 250000, currency: "NGN", metadata: { user_id: "buyer", item: "pro_monthly" } };
  it("requires the exact naira price", () => {
    assert.equal(CATALOG.pro_monthly.amount, 2500);
    assert.equal(CATALOG.max_monthly.amount, 5000);
    assert.equal(CATALOG.pro_semester.amount, 6000);
    assert.equal(CATALOG.max_semester.amount, 12000);
    assert.throws(() => validatePayment({ ...tx, amount: 249999 }, "ref", "buyer"));
    assert.throws(() => validatePayment({ ...tx, amount: 250001 }, "ref", "buyer"));
    assert.equal(validatePayment(tx, "ref", "buyer").item, "pro_monthly");
  });
  it("rejects another buyer, currency, reference and prototype keys", () => {
    assert.throws(() => validatePayment(tx, "ref", "other"));
    assert.throws(() => validatePayment({ ...tx, currency: "USD" }, "ref"));
    assert.throws(() => validatePayment(tx, "other-ref"));
    assert.throws(() => validatePayment({ ...tx, metadata: { user_id: "buyer", item: "constructor" } }, "ref"));
  });
});
describe("exports and search", () => {
  it("neutralizes spreadsheet formulas while preserving normal text", () => {
    assert.equal(safeCsvCell("=1+1"), '"\'=1+1"');
    assert.equal(safeCsvCell(" \t@SUM(1)"), '"\' \t@SUM(1)"');
    assert.equal(safeCsvCell('say "hello"'), '"say ""hello"""');
  });
  it("quotes filter punctuation as one literal", () => {
    assert.equal(searchPattern('x",id.not.is.null'), '"%x\\",id.not.is.null%"');
  });
});