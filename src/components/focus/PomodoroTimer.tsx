/**
 * Trevor — Pomodoro Focus Timer
 *
 * A small floating widget anchored to the bottom-right corner.  Cycles
 * between Focus (25 min) and Break (5 min) phases.  Survives reloads
 * via localStorage so a session in progress is restored.
 *
 * Plays a soft beep when a phase ends; falls back silently if Web
 * Audio is unavailable.
 */
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, X, Coffee, Brain } from "lucide-react";

const FOCUS_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;

interface PomodoroTimerProps {
  open: boolean;
  onClose: () => void;
}

interface PersistedTimer {
  endsAt: number | null;     // epoch when current phase ends (paused if null)
  remaining: number;         // ms left when paused
  phase: "focus" | "break";
  running: boolean;
  cycles: number;            // completed focus cycles
}

const KEY = "trevor.pomodoro.v1";

function load(): PersistedTimer {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { endsAt: null, remaining: FOCUS_MS, phase: "focus", running: false, cycles: 0 };
}

function save(state: PersistedTimer) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function PomodoroTimer({ open, onClose }: PomodoroTimerProps) {
  const [state, setState] = useState<PersistedTimer>(() => load());
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every 250ms while running.
  useEffect(() => {
    if (!state.running || !state.endsAt) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => setNow(Date.now()), 250);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state.running, state.endsAt]);

  // Persist on every change.
  useEffect(() => save(state), [state]);

  // When endsAt passes, flip to the other phase.
  useEffect(() => {
    if (!state.running || !state.endsAt) return;
    if (now >= state.endsAt) {
      // Phase ended.
      void chime();
      try { document.title = `⏰ ${state.phase === "focus" ? "Break time!" : "Focus!"} · Trevor`; } catch { /* ignore */ }
      const nextPhase = state.phase === "focus" ? "break" : "focus";
      const nextDur = nextPhase === "focus" ? FOCUS_MS : BREAK_MS;
      setState((s) => ({
        endsAt: Date.now() + nextDur,
        remaining: nextDur,
        phase: nextPhase,
        running: true,
        cycles: s.phase === "focus" ? s.cycles + 1 : s.cycles,
      }));
    }
  }, [now, state]);

  const toggle = () => {
    setState((s) => {
      if (s.running) {
        const remaining = Math.max(0, (s.endsAt ?? Date.now()) - Date.now());
        return { ...s, running: false, endsAt: null, remaining };
      }
      return { ...s, running: true, endsAt: Date.now() + (s.remaining || FOCUS_MS) };
    });
  };

  const reset = () => {
    setState({
      endsAt: null,
      remaining: FOCUS_MS,
      phase: "focus",
      running: false,
      cycles: 0,
    });
    try { document.title = "Trevor"; } catch { /* ignore */ }
  };

  if (!open) return null;

  const remainingMs = state.running && state.endsAt ? Math.max(0, state.endsAt - now) : state.remaining;
  const total = state.phase === "focus" ? FOCUS_MS : BREAK_MS;
  const ratio = 1 - remainingMs / total;
  const mm = Math.floor(remainingMs / 60_000);
  const ss = Math.floor((remainingMs % 60_000) / 1000);

  return (
    <div className="fixed bottom-10 right-4 z-50 w-60 bg-trevor-bg-elevated border border-trevor-border rounded-xl shadow-elevation-2 overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-trevor-border-subtle">
        <div className="flex items-center gap-1.5 text-[12px] font-medium">
          {state.phase === "focus" ? (
            <><Brain size={12} className="text-trevor-accent" /><span className="text-trevor-text">Focus</span></>
          ) : (
            <><Coffee size={12} className="text-trevor-success" /><span className="text-trevor-text">Break</span></>
          )}
          <span className="text-trevor-text-muted text-[10.5px] ml-1">· {state.cycles} done</span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover transition-colors"
          title="Close"
        >
          <X size={11} />
        </button>
      </div>

      <div className="px-4 pt-3 pb-3 flex flex-col items-center">
        <div className="relative w-24 h-24 my-1">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" stroke="var(--color-border)" strokeWidth="6" fill="none" />
            <circle
              cx="50" cy="50" r="44"
              stroke={state.phase === "focus" ? "var(--color-accent)" : "var(--color-success)"}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - ratio)}
              style={{ transition: "stroke-dashoffset 250ms linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-trevor-text font-mono text-[18px] tabular-nums">
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={toggle}
            className="px-3 py-1.5 text-[12px] bg-trevor-accent text-white rounded-md hover:bg-trevor-accent-hover transition-colors flex items-center gap-1.5"
          >
            {state.running ? <><Pause size={11} /> Pause</> : <><Play size={11} /> Start</>}
          </button>
          <button
            onClick={reset}
            className="p-1.5 text-trevor-text-muted hover:text-trevor-text rounded hover:bg-trevor-surface-hover transition-colors"
            title="Reset"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Soft "ding" via WebAudio. */
async function chime() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 660;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.start(t);
    o.stop(t + 0.7);
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* silent */
  }
}
