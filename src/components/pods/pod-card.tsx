import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PodWithCount } from "@/lib/queries";

export function PodCard({ pod }: { pod: PodWithCount }) {
  return (
    <Link to="/pod/$podId" params={{ podId: pod.id }} className="group block">
      <Card className="h-full lift overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="h-1 w-full bg-[image:var(--gradient-brand)] opacity-70 transition-opacity group-hover:opacity-100" />
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="display text-lg leading-tight transition-colors group-hover:text-brand-purple">{pod.name}</CardTitle>
            {pod.course_code ? <Badge variant="secondary">{pod.course_code}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4 text-brand-sky" />
            {pod.member_count} member{pod.member_count === 1 ? "" : "s"}
          </span>
          <span className="font-mono text-xs uppercase">{pod.invite_code}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
