import { Mic, Sparkles } from "lucide-react";

/** Decorative audio artwork; it does not claim to measure microphone levels. */
export function AiAudioVisual({ recording }: { recording: boolean }) {
  return (
    <div className={`ai-audio-visual ${recording ? "is-recording" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 600 200" className="audio-orbits" fill="none">
        <ellipse cx="300" cy="100" rx="170" ry="64" />
        <ellipse cx="300" cy="100" rx="133" ry="83" />
        <ellipse cx="300" cy="100" rx="206" ry="38" />
      </svg>
      <div className="audio-wave audio-wave-left">
        {Array.from({ length: 19 }, (_, i) => <span key={i} className={`audio-line audio-line-${i % 5}`} />)}
      </div>
      <div className="audio-core"><Mic className="size-8" /><Sparkles className="audio-spark size-4" /></div>
      <div className="audio-wave audio-wave-right">
        {Array.from({ length: 19 }, (_, i) => <span key={i} className={`audio-line audio-line-${(i + 2) % 5}`} />)}
      </div>
    </div>
  );
}