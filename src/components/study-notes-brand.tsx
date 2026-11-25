import logoUrl from "@/assets/study-notes-hub-logo-compact.png";
import { cn } from "@/lib/utils";

/** Preserve the approved book/cap artwork, with the current app name beside it. */
export function StudyNotesBrand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-logo-surface"
      >
        <img src={logoUrl} alt="" className="h-full w-auto max-w-none" />
      </span>
      <span className="whitespace-nowrap font-serif text-lg font-semibold text-foreground">
        Study Notes
      </span>
    </span>
  );
}
