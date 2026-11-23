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
    <div className="rise-in flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <span className="icon-chip size-14 shadow-glow logo-glow">
            <Icon className="size-6" />
          </span>
        <div className="space-y-1">
          <p className="display text-lg font-semibold">{title}</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
    </div>
  );
}
