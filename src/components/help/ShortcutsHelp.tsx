/**
 * Trevor — Keyboard Shortcuts Help
 *
 * Comprehensive reference dialog (⌘/) listing every shortcut grouped
 * by category.  Detects Mac vs. other platforms to render the correct
 * modifier symbols.
 */
import { useEffect } from "react";
import { X, Keyboard } from "lucide-react";
import { platform } from "@/lib/platform";

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string;       // human-readable, "Cmd+K" — display normalises ⌘
  label: string;
}

const GROUPS: Array<{ title: string; items: Shortcut[] }> = [
  {
    title: "Global",
    items: [
      { keys: "Cmd+K",       label: "Command palette / search" },
      { keys: "Cmd+,",       label: "Open settings" },
      { keys: "Cmd+/",       label: "Show keyboard shortcuts" },
      { keys: "Cmd+Shift+G", label: "Toggle graph view" },
      { keys: "Cmd+Shift+C", label: "Open canvas (whiteboard)" },
      { keys: "Cmd+Shift+D", label: "Open / create today's daily note" },
      { keys: "Cmd+.",       label: "Toggle right side panel" },
      { keys: "Cmd+P",       label: "Toggle Pomodoro focus timer" },
    ],
  },
  {
    title: "Notes",
    items: [
      { keys: "Cmd+N", label: "Create new note" },
      { keys: "Cmd+S", label: "Save the current note" },
      { keys: "Cmd+F", label: "Find in current note" },
      { keys: "Cmd+[", label: "Back to previous note" },
      { keys: "Cmd+]", label: "Forward to next note" },
    ],
  },
  {
    title: "Selection & bulk operations",
    items: [
      { keys: "Cmd+Click",   label: "Toggle a note in the multi-selection" },
      { keys: "Shift+Click", label: "Range-select notes" },
      { keys: "Esc",         label: "Clear multi-selection" },
      { keys: "Drag",        label: "Move selected notes onto a folder" },
    ],
  },
  {
    title: "Search",
    items: [
      { keys: "Cmd+K",       label: "Open command palette (titles + content)" },
      { keys: "Type ≥ 2 chars", label: "Search note bodies, with inline highlights" },
      { keys: "↵ on a snippet", label: "Open the note and jump to the match" },
    ],
  },
  {
    title: "Editor formatting",
    items: [
      { keys: "Cmd+B", label: "Bold" },
      { keys: "Cmd+I", label: "Italic" },
      { keys: "Cmd+U", label: "Underline" },
      { keys: "Cmd+E", label: "Inline code" },
      { keys: "Cmd+K", label: "Insert link (in editor)" },
      { keys: "Tab",   label: "Indent line / list item" },
      { keys: "Shift+Tab", label: "Outdent line / list item" },
    ],
  },
  {
    title: "Export & import",
    items: [
      { keys: "Title bar ↓",  label: "Export as PDF / HTML / Markdown / vault bundle" },
      { keys: "Title bar ↑",  label: "Import a previously-exported vault bundle" },
    ],
  },
  {
    title: "Snippets",
    items: [
      { keys: ":trigger + Tab", label: "Expand a snippet (e.g. :date, :meeting)" },
    ],
  },
  {
    title: "Canvas",
    items: [
      { keys: "V", label: "Select tool" },
      { keys: "T", label: "Text card" },
      { keys: "N", label: "Note embed" },
      { keys: "L", label: "Link card" },
      { keys: "G", label: "Group box" },
      { keys: "Cmd+Scroll", label: "Zoom" },
      { keys: "Drag background", label: "Pan" },
      { keys: "Del / Backspace", label: "Delete selected node" },
      { keys: "Cmd+S", label: "Save canvas now" },
    ],
  },
  {
    title: "Overlay dismissal",
    items: [
      { keys: "Esc", label: "Close any modal, palette, or overlay" },
    ],
  },
];

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] bg-trevor-bg-secondary border border-trevor-border rounded-xl shadow-elevation-2 flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-trevor-border-subtle">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-trevor-accent" />
            <h2 className="text-[14px] font-semibold text-trevor-text">Keyboard shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-5">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="text-[10.5px] uppercase tracking-wider text-trevor-text-muted font-medium mb-2">
                {g.title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                {g.items.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-trevor-border-subtle last:border-0">
                    <span className="text-[12.5px] text-trevor-text-secondary">{s.label}</span>
                    <KeyCombo combo={s.keys} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="px-5 py-2.5 border-t border-trevor-border-subtle text-[10.5px] text-trevor-text-muted flex items-center justify-between">
          <span>Press <kbd className="font-mono">Esc</kbd> to close</span>
          <span>Trevor · Phase 5</span>
        </div>
      </div>
    </div>
  );
}

function KeyCombo({ combo }: { combo: string }) {
  // Normalise display to use ⌘ on Mac, Ctrl elsewhere.
  const display = combo
    .split("+")
    .map((part) => {
      const k = part.trim();
      if (k === "Cmd") return platform.isMac ? "⌘" : "Ctrl";
      if (k === "Shift") return platform.isMac ? "⇧" : "Shift";
      if (k === "Alt") return platform.isMac ? "⌥" : "Alt";
      return k;
    });
  return (
    <span className="flex items-center gap-1 flex-shrink-0">
      {display.map((part, idx) => (
        <kbd
          key={idx}
          className="font-mono text-[10.5px] px-1.5 py-0.5 bg-trevor-bg-elevated border border-trevor-border rounded text-trevor-text-secondary min-w-[1.4em] text-center"
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}
