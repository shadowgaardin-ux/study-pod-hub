export interface CourseOrganizedNote {
  semester: string | null;
  course: string | null;
}

export interface CourseGroup<T> {
  course: string | null;
  notes: T[];
}

export interface SemesterGroup<T> {
  semester: string | null;
  courses: CourseGroup<T>[];
}

/** Store concise, consistent labels while keeping both fields optional. */
export function cleanOrganizationLabel(value: string | null | undefined): string | null {
  const cleaned = value?.trim().replace(/\s+/g, " ");
  return cleaned || null;
}

/** Existing suggestions are only a convenience; students can always type a new label. */
export function organizationSuggestions<T extends CourseOrganizedNote>(
  notes: T[],
  field: keyof CourseOrganizedNote,
): string[] {
  return [...new Set(notes.map((note) => cleanOrganizationLabel(note[field])).filter(Boolean))]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b));
}

/** Group the existing newest-first note list without changing its underlying query. */
export function groupNotesBySemester<T extends CourseOrganizedNote>(
  notes: T[],
): SemesterGroup<T>[] {
  const semesters = new Map<string, SemesterGroup<T>>();

  for (const note of notes) {
    const semester = cleanOrganizationLabel(note.semester);
    const course = cleanOrganizationLabel(note.course);
    const semesterKey = semester ?? "";
    let semesterGroup = semesters.get(semesterKey);
    if (!semesterGroup) {
      semesterGroup = { semester, courses: [] };
      semesters.set(semesterKey, semesterGroup);
    }

    let courseGroup = semesterGroup.courses.find((group) => group.course === course);
    if (!courseGroup) {
      courseGroup = { course, notes: [] };
      semesterGroup.courses.push(courseGroup);
    }
    courseGroup.notes.push(note);
  }

  return [...semesters.values()];
}
