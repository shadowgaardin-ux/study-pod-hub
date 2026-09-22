import { useNavigate } from "@tanstack/react-router";
import { FileText, Layers, Search, Users } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalSearch, type SearchResult } from "@/lib/library";

const ICONS = {
  note: FileText,
  pod: Users,
  deck: Layers,
} as const;

export function GlobalSearch() {
  const { user } = useAuth();
  const [term, setTerm] = useState("");
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  const results = useGlobalSearch(term, user?.id);

  function open(result: SearchResult) {
    setTerm("");
    setFocused(false);
    if (result.podId) void navigate({ to: "/pod/$podId", params: { podId: result.podId } });
    else void navigate({ to: "/dashboard" });
  }

  const list = results.data ?? [];
  const show = focused && term.trim().length >= 2;

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        placeholder="Search notes, transcripts, pods, decks…"
        className="pl-9"
        aria-label="Search everything"
      />
      {show ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {results.isLoading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : list.length ? (
            <ul className="max-h-80 overflow-y-auto py-1">
              {list.map((result) => {
                const Icon = ICONS[result.kind];
                return (
                  <li key={`${result.kind}-${result.id}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => open(result)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{result.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Nothing matched “{term.trim()}”.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
