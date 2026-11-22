import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PodWithCount } from "@/lib/queries";

export function PodCard({ pod }: { pod: PodWithCount }) {
  return (
    <Link to="/pod/$podId" params={{ podId: pod.id }} className="group block">
      <Card className="h-full lift overflow-hidden transition-shadow group-hover:border-brand-sky/40">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-brand-sky/20 bg-brand-sky/10 text-brand-sky"><BookOpen className="size-5" /></span>
            <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          {pod.course_code ? <Badge variant="secondary" className="mt-3 w-fit text-brand-sky">{pod.course_code}</Badge> : null}
          <CardTitle className="display break-words text-lg leading-snug transition-colors group-hover:text-brand-purple">{pod.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4 text-brand-sky" />
            {pod.member_count} member{pod.member_count === 1 ? "" : "s"}
          </span>
          <span className="text-xs text-brand-purple">Open pod</span>
        </CardContent>
      </Card>
    </Link>
  );
}
