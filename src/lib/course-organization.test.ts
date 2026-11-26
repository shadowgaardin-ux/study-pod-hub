import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  cleanOrganizationLabel,
  groupNotesBySemester,
  organizationSuggestions,
} from "./course-organization";

const note = (id: string, semester: string | null, course: string | null) => ({
  id,
  semester,
  course,
});

describe("course organization", () => {
  it("keeps existing notes available in an unorganized group", () => {
    const groups = groupNotesBySemester([note("legacy", null, null)]);
    assert.equal(groups[0]?.semester, null);
    assert.equal(groups[0]?.courses[0]?.course, null);
    assert.equal(groups[0]?.courses[0]?.notes[0]?.id, "legacy");
  });

  it("nests lectures under their course and semester", () => {
    const groups = groupNotesBySemester([
      note("one", "Second Semester", "CSC 201"),
      note("two", "Second Semester", "CSC 201"),
      note("three", "Second Semester", "MTH 204"),
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.courses.length, 2);
    assert.equal(groups[0]?.courses[0]?.notes.length, 2);
    assert.equal(groups[0]?.courses[1]?.notes[0]?.id, "three");
  });

  it("normalizes labels and offers unique existing suggestions", () => {
    assert.equal(cleanOrganizationLabel("  CSC   201  "), "CSC 201");
    assert.equal(cleanOrganizationLabel("   "), null);
    assert.deepEqual(
      organizationSuggestions(
        [note("one", "First Semester", "CSC 201"), note("two", "First Semester", "MTH 101")],
        "course",
      ),
      ["CSC 201", "MTH 101"],
    );
  });
});
