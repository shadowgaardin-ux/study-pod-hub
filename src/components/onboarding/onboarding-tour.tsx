import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleHelp, LayoutDashboard, Library, Mic, PartyPopper, PlayCircle, RotateCcw, Sparkles, Users, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { TOUR_METADATA_KEY, TOUR_STEPS, TUTORIAL_VIDEO_URL, hasCompletedTour, rememberTourOnDevice, type TourStepId } from "@/lib/onboarding";

const STEP_ICONS: Record<TourStepId, typeof Mic> = {
  dashboard: LayoutDashboard,
  record: Mic,
  library: Library,
  pods: Users,
  assistant: Sparkles,
  finish: PartyPopper,
};

interface TourContextValue {
  startTour: () => void;
  openVideo: () => void;
}

const TourContext = createContext<TourContextValue>({ startTour: () => {}, openVideo: () => {} });

export function useTour() {
  return useContext(TourContext);
}

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Mounts the first-login tour and the tutorial video dialog for signed-in screens. */
export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });
  const [step, setStep] = useState<number | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const autoChecked = useRef<string | null>(null);

  const onDashboardHome = pathname === "/dashboard" && !hash;

  const userRef = useRef(user);
  userRef.current = user;
  const userId = user?.id;

  // Auto-open once for users who have never finished or skipped the tour.
  useEffect(() => {
    if (!userId || !onDashboardHome || autoChecked.current === userId) return;
    const timer = window.setTimeout(() => {
      autoChecked.current = userId;
      if (!hasCompletedTour(userId, userRef.current?.user_metadata, safeLocalStorage())) setStep(0);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [userId, onDashboardHome]);

  const startTour = useCallback(() => {
    if (!onDashboardHome) void navigate({ to: "/dashboard", hash: "" });
    setStep(0);
  }, [navigate, onDashboardHome]);

  const complete = useCallback(() => {
    setStep(null);
    if (!user) return;
    const at = new Date().toISOString();
    rememberTourOnDevice(user.id, safeLocalStorage(), at);
    if (typeof user.user_metadata?.[TOUR_METADATA_KEY] !== "string") {
      void supabase.auth.updateUser({ data: { [TOUR_METADATA_KEY]: at } }).catch(() => {});
    }
  }, [user]);

  const value = useMemo(() => ({ startTour, openVideo: () => setVideoOpen(true) }), [startTour]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {step !== null && <TourOverlay step={step} onStep={setStep} onDone={complete} />}
      <TutorialVideoDialog open={videoOpen} onOpenChange={setVideoOpen} />
    </TourContext.Provider>
  );
}

interface Rect { top: number; left: number; width: number; height: number }

function findTarget(targets: string[]): HTMLElement | null {
  for (const name of targets) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && !el.closest("[hidden]")) return el;
    }
  }
  return null;
}

const PAD = 8;
const GAP = 16;

function TourOverlay({ step, onStep, onDone }: { step: number; onStep: (n: number) => void; onDone: () => void }) {
  const current = TOUR_STEPS[step] ?? TOUR_STEPS[0]!;
  const total = TOUR_STEPS.length;
  const isLast = step === total - 1;
  const Icon = STEP_ICONS[current.id];
  const cardRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardSize, setCardSize] = useState({ w: 340, h: 230 });
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });

  // Scroll the highlighted item into view, then keep the spotlight glued to it.
  useEffect(() => {
    let frame = 0;
    let scrolled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const measure = () => {
      const el = findTarget(current.targets);
      if (el && !scrolled) {
        scrolled = true;
        const r = el.getBoundingClientRect();
        if (r.top < 80 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      }
      const r = el?.getBoundingClientRect();
      setRect((prev) => {
        if (!r) return prev === null ? prev : null;
        const next = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
        return prev && Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.left - next.left) < 0.5 && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.height - next.height) < 0.5 ? prev : next;
      });
      setViewport((prev) => (prev.w === window.innerWidth && prev.h === window.innerHeight ? prev : { w: window.innerWidth, h: window.innerHeight }));
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [current]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
      else if (e.key === "ArrowRight") isLast ? onDone() : onStep(step + 1);
      else if (e.key === "ArrowLeft" && step > 0) onStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, isLast, onStep, onDone]);

  const position = useMemo(() => {
    const { w: vw, h: vh } = viewport;
    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
    if (!rect) return { top: (vh - cardSize.h) / 2, left: (vw - cardSize.w) / 2 };
    if (vw < 640) {
      // Phones: dock the card at the bottom, or the top when the highlight sits low.
      const below = rect.top + rect.height / 2 < vh / 2;
      return { top: below ? vh - cardSize.h - GAP : GAP, left: GAP };
    }
    if (rect.left + rect.width + GAP + cardSize.w < vw - GAP && rect.width < vw / 3) {
      return { top: clamp(rect.top + rect.height / 2 - cardSize.h / 2, GAP, vh - cardSize.h - GAP), left: rect.left + rect.width + GAP };
    }
    const left = clamp(rect.left + rect.width / 2 - cardSize.w / 2, GAP, vw - cardSize.w - GAP);
    const top = rect.top + rect.height + GAP + cardSize.h < vh - GAP ? rect.top + rect.height + GAP : clamp(rect.top - GAP - cardSize.h, GAP, vh - cardSize.h - GAP);
    return { top, left };
  }, [rect, cardSize, viewport]);

  return (
    <div className="fixed inset-0 z-[100]" role="presentation">
      {rect ? (
        <div
          aria-hidden
          className="tour-spotlight pointer-events-none fixed rounded-2xl motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : (
        <div aria-hidden className="tour-backdrop fixed inset-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className="glow-ring fixed w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-5 shadow-glow-strong outline-none motion-safe:transition-[top,left] motion-safe:duration-500 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
        style={{ top: position.top, left: position.left }}
      >
        <div key={current.id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
          <div className="flex items-start justify-between gap-3">
            <span className={`icon-chip size-10 ${isLast ? "tour-celebrate" : ""}`}>
              <Icon className="size-5" />
            </span>
            <button type="button" onClick={onDone} className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Close tour">
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-brand-sky">Step {step + 1} of {total}</p>
          <h2 id="tour-title" className="display mt-1 text-lg font-semibold">{current.title}</h2>
          <p id="tour-body" className="mt-1.5 text-sm leading-6 text-muted-foreground">{current.body}</p>
        </div>

        <div className="mt-4 flex items-center gap-1.5" role="progressbar" aria-label="Tour progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}>
          {TOUR_STEPS.map((s, i) => (
            <span key={s.id} className={`h-1.5 rounded-full motion-safe:transition-all motion-safe:duration-300 ${i === step ? "w-6 bg-gradient-primary" : i < step ? "w-1.5 bg-primary/60" : "w-1.5 bg-muted"}`} />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {isLast ? <span /> : <Button variant="ghost" size="sm" className="px-2 text-muted-foreground" onClick={onDone}>Skip tour</Button>}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => onStep(step - 1)}>
                <ArrowLeft className="size-4" />Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={onDone}><Check className="size-4" />Finish</Button>
            ) : (
              <Button size="sm" onClick={() => onStep(step + 1)}>Next<ArrowRight className="size-4" /></Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TutorialVideoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tutorial video</DialogTitle>
          <DialogDescription>A short walkthrough of recording, notes, pods and the AI Assistant.</DialogDescription>
        </DialogHeader>
        {TUTORIAL_VIDEO_URL ? (
          <div className="aspect-video overflow-hidden rounded-xl border border-border bg-muted">
            <iframe src={TUTORIAL_VIDEO_URL} title="Study Pods Hub tutorial" className="size-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Header Help menu: replay the tour or watch the tutorial video once published. */
export function HelpMenu() {
  const { startTour, openVideo } = useTour();
  const hasVideo = Boolean(TUTORIAL_VIDEO_URL);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Help" data-tour="help">
          <CircleHelp className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2"><BookOpen className="size-4 text-brand-sky" />Help</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={startTour}><RotateCcw className="size-4" />Replay tour</DropdownMenuItem>
        <DropdownMenuItem disabled={!hasVideo} onSelect={openVideo}>
          <PlayCircle className="size-4" />Watch tutorial video
          {!hasVideo && <Badge variant="soft" className="ml-auto whitespace-nowrap text-[10px]">Coming soon</Badge>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
