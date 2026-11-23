import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 border-y border-dashed border-border px-6 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            <Icon className="size-7" />
          </span>
        <div className="space-y-1">
          <p className="display text-lg font-semibold">{title}</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
    </div>
  );
}
