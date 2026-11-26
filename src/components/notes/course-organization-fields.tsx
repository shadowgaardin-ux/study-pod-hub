import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CourseOrganizationFields({
  semester,
  course,
  semesters,
  courses,
  disabled = false,
  onSemesterChange,
  onCourseChange,
}: {
  semester: string;
  course: string;
  semesters?: string[];
  courses?: string[];
  disabled?: boolean;
  onSemesterChange: (value: string) => void;
  onCourseChange: (value: string) => void;
}) {
  const id = useId();
  const semesterId = `${id}-semester`;
  const courseId = `${id}-course`;
  const semesterListId = `${id}-semesters`;
  const courseListId = `${id}-courses`;

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 text-left">
          <Label htmlFor={semesterId} className="text-xs text-muted-foreground">
            Semester <span className="font-normal">(optional)</span>
          </Label>
          <Input
            id={semesterId}
            value={semester}
            disabled={disabled}
            onChange={(event) => onSemesterChange(event.target.value)}
            placeholder="e.g. First Semester 2026"
            list={semesterListId}
            autoComplete="off"
          />
          <datalist id={semesterListId}>
            {(semesters ?? []).map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5 text-left">
          <Label htmlFor={courseId} className="text-xs text-muted-foreground">
            Course <span className="font-normal">(optional)</span>
          </Label>
          <Input
            id={courseId}
            value={course}
            disabled={disabled}
            onChange={(event) => onCourseChange(event.target.value)}
            placeholder="e.g. CSC 201 · Data Structures"
            list={courseListId}
            autoComplete="off"
          />
          <datalist id={courseListId}>
            {(courses ?? []).map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
      </div>
      <p className="text-left text-xs text-muted-foreground">
        Pick an existing label or type a new one to organize this lecture.
      </p>
    </div>
  );
}
