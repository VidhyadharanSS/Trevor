/**
 * Trevor — Find-in-note (⌘F)
 *
 * A compact overlay anchored at the top-right of the editor pane
 * that searches the current note's textarea content.  Shows match
 * count + Prev/Next, with cyclic navigation.  The matched range is
 * selected inside the textarea so the browser scrolls it into view.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, ChevronUp, ChevronDown, CaseSensitive } from "lucide-react";

interface FindInNoteProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  open: boolean;
  onClose: () => void;
  /** Re-bind when content changes so match list refreshes. */
  content: string;
}

export function FindInNote({ textareaRef, open, onClose, content }: FindInNoteProps) {
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute all match indices in content.
  const matches = useMemo(() => {
    if (!query) return [] as number[];
    const out: number[] = [];
    const haystack = caseSensitive ? content : content.toLowerCase();
    const needle = caseSensitive ? query : query.toLowerCase();
    let from = 0;
    while (true) {
      const i = haystack.indexOf(needle, from);
      if (i === -1) break;
      out.push(i);
      from = i + needle.length;
      if (out.length > 999) break; // safety cap
    }
    return out;
  }, [content, query, caseSensitive]);

  // Reset active match whenever the query changes.
  useEffect(() => { setActive(0); }, [query, caseSensitive]);

  // Focus input when opened.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open]);

  /** Highlight a match in the textarea (selectionRange + scroll). */
  const focusMatch = useCallback(
    (idx: number) => {
      const ta = textareaRef.current;
      if (!ta || matches.length === 0) return;
      const safe = ((idx % matches.length) + matches.length) % matches.length;
      const start = matches[safe];
      const end = start + query.length;
      ta.focus();
      ta.setSelectionRange(start, end);
      // Scroll the textarea so the selection is visible.
      const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 24;
      const before = content.slice(0, start);
      const lineNum = before.split("\n").length;
      ta.scrollTop = Math.max(0, lineNum * lineHeight - ta.clientHeight / 2);
    },
    [textareaRef, matches, query, content],
  );

  // Auto-focus the active match whenever it changes.
  useEffect(() => {
    if (open && matches.length > 0) focusMatch(active);
  }, [active, open, matches.length, focusMatch]);

  const next = useCallback(() => setActive((i) => (i + 1) % Math.max(1, matches.length)), [matches.length]);
  const prev = useCallback(() => setActive((i) => (i - 1 + Math.max(1, matches.length)) % Math.max(1, matches.length)), [matches.length]);

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) prev(); else next();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [next, prev, onClose],
  );

  if (!open) return null;

  return (
    <div className="absolute top-2 right-3 z-30 flex items-center gap-1.5 px-2 py-1 bg-trevor-bg-elevated border border-trevor-border rounded-md shadow-elevation-2 animate-fade-in">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKey}
        placeholder="Find in note…"
        className="bg-transparent text-[12.5px] text-trevor-text placeholder:text-trevor-text-muted outline-none w-44"
      />
      <span className="text-[10.5px] text-trevor-text-muted tabular-nums">
        {matches.length === 0 && query ? "0/0" : `${Math.min(active + 1, matches.length)}/${matches.length}`}
      </span>
      <button
        onClick={() => setCaseSensitive((v) => !v)}
        className={`p-1 rounded transition-colors ${
          caseSensitive
            ? "text-trevor-accent bg-trevor-accent/10"
            : "text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover"
        }`}
        title="Match case"
      >
        <CaseSensitive size={12} />
      </button>
      <button
        onClick={prev}
        disabled={matches.length === 0}
        className="p-1 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Previous (Shift+Enter)"
      >
        <ChevronUp size={12} />
      </button>
      <button
        onClick={next}
        disabled={matches.length === 0}
        className="p-1 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Next (Enter)"
      >
        <ChevronDown size={12} />
      </button>
      <button
        onClick={onClose}
        className="p-1 rounded text-trevor-text-muted hover:text-trevor-danger hover:bg-trevor-danger/10 transition-colors"
        title="Close (Esc)"
      >
        <X size={12} />
      </button>
    </div>
  );
}
