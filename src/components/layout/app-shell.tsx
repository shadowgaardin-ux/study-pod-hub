import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Library,
  Menu,
  Mic,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { StudyNotesBrand } from "@/components/study-notes-brand";

import { GlobalSearch } from "@/components/dashboard/global-search";
import { HelpMenu, TourProvider } from "@/components/onboarding/onboarding-tour";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { initials } from "@/lib/queries";

const NAV = [
  { to: "/dashboard", hash: "", label: "Dashboard", icon: LayoutDashboard, tour: "nav-dashboard" },
  { to: "/dashboard", hash: "library", label: "My Library", icon: Library, tour: "nav-library" },
  { to: "/pods", hash: "", label: "Study Pods", icon: Users, tour: "nav-pods" },
  { to: "/dashboard", hash: "recording", label: "Lecture Recording", icon: Mic, tour: "nav-recording" },
  { to: "/dashboard", hash: "assistant", label: "AI Assistant", icon: Sparkles, tour: "nav-assistant" },
  { to: "/billing", hash: "", label: "Billing & Plans", icon: CreditCard, tour: "nav-billing" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hash = useRouterState({ select: (state) => state.location.hash });
  const currentPage = pathname.startsWith("/pod/") ? "Pod workspace" : NAV.find((item) => item.to === pathname && item.hash === hash)?.label ?? (pathname === "/settings" ? "Settings" : "Dashboard");

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    void navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <nav className="flex min-h-0 flex-1 flex-col gap-1.5 px-4 py-5" aria-label="Main navigation">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase text-muted-foreground">Workspace</p>
      {NAV.map(({ to, hash: targetHash, label, icon: Icon, tour }) => {
        const active = (pathname === to && hash === targetHash) || (to === "/pods" && pathname.startsWith("/pod/"));
        return (
          <Link
            key={label}
            to={to}
            hash={targetHash}
            data-tour={tour}
            aria-current={active ? "page" : undefined}
            onClick={() => setMobileOpen(false)}
            className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
              active
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:translate-x-0.5 hover:bg-secondary/80 hover:text-foreground [&>svg]:group-hover:text-brand-sky"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
      <div className="mt-auto border-t border-sidebar-border pt-4">
      <Button asChild variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
        <Link to="/settings" onClick={() => setMobileOpen(false)}><Settings className="size-4" />Settings</Link>
      </Button>
      <Button variant="ghost"
        onClick={handleSignOut}
        className="w-full justify-start gap-3 text-muted-foreground"
      >
        <LogOut className="size-4" />
        Log out
      </Button>
      </div>
      <div className="mt-3 flex min-w-0 items-center gap-3 border-t border-sidebar-border px-2 pt-5">
        <Avatar className="size-9 shrink-0 ring-2 ring-primary/30"><AvatarImage src={profile?.avatar_url ?? undefined} alt="" /><AvatarFallback>{initials(profile?.full_name || user?.email)}</AvatarFallback></Avatar>
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{profile?.full_name || "Student"}</p><p className="text-xs text-muted-foreground">{profile?.tier ?? "Free"} plan</p></div>
      </div>
    </nav>
  );

  const brand = (
    <Link to="/dashboard" className="flex h-20 shrink-0 items-center border-b border-sidebar-border px-6" aria-label="Study Notes dashboard">
      <StudyNotesBrand />
    </Link>
  );

  return (
    <TourProvider>
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar bg-[image:radial-gradient(ellipse_80%_30%_at_0%_0%,var(--ambient-1),transparent)] lg:flex">
        {brand}
        {nav}
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-border/70 glass px-4 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-5">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col">
                  {brand}
                  {nav}
                </div>
              </SheetContent>
            </Sheet>
            <div className="hidden shrink-0 items-center gap-2 text-sm xl:flex"><span className="text-muted-foreground">Workspace</span><span className="text-muted-foreground" aria-hidden> / </span><span className="font-semibold">{currentPage}</span></div>
            <div className="min-w-0"><GlobalSearch /></div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="soft" className="hidden sm:inline-flex">
              {profile?.tier ?? "Free"} plan
            </Badge>
            <HelpMenu />
            <ThemeToggle />
            <Button asChild variant="ghost" size="icon" aria-label="Settings" className="hidden sm:inline-flex">
              <Link to="/settings">
                <Settings className="size-5" />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
                  <Avatar className="size-8">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback>{initials(profile?.full_name || user?.email)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-medium">{profile?.full_name || "Student"}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/billing">Billing</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleSignOut()}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
    </TourProvider>
  );
}
