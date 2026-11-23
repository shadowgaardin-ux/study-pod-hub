import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Shared page heading so every signed-in screen opens with the same rhythm. */
export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="rise-in flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        {Icon ? (
          <span className="icon-chip size-12 shadow-glow">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-brand-sky">{eyebrow}</p> : null}
          <h1 className="display text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
          {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
