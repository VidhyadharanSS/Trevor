/**
 * Trevor — Command Palette
 *
 * A spotlight-style modal triggered by ⌘K. Indexes:
 *   • All notes in the current vault (by title + path)
 *   • All registered commands (open settings, toggle theme, …)
 *   • Every #tag in the vault
 *   • **Note content** — full-text fuzzy search across every note's body,
 *     returning multiple highlighted snippets per matching note.
 *
 * Results are grouped, keyboard-navigable, and clicking a content snippet
 * jumps the editor to that note (and, where supported, scrolls to the line
 * containing the match).
 */
import {
  useState, useEffect, useMemo, useRef, useCallback,
} from "react";
import Fuse from "fuse.js";
import {
  FileText, Settings as SettingsIcon, Sun, Moon,
  Hash, FolderOpen, Plus, Search, Quote,
} from "lucide-react";
import type { TreeNode } from "@/lib/fs/types";

export interface PaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  category: "command" | "note" | "tag" | "content";
  keywords?: string[];
  /** Pre-computed highlighted HTML snippet (for `content` category). */
  snippetHtml?: string;
  /** Line number of the match within the note (for jump-to-line). */
  matchLine?: number;
  /** Path of the underlying note for content-category items. */
  notePath?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  notes: TreeNode[];                       // every .md / .canvas in the vault
  tags: string[];                          // every #tag
  commands: PaletteCommand[];              // registered commands
  /** Vault-wide content cache — drives full-text search. */
  contentCache?: Map<string, string>;
  onOpenNote: (path: string, line?: number) => void;
  onSelectTag: (tag: string) => void;
}

export function CommandPalette({
  open, onClose, notes, tags, commands, contentCache,
  onOpenNote, onSelectTag,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  // ── Indexable items (commands + notes + tags) ────────────────────
  const items = useMemo<PaletteCommand[]>(() => {
    const noteCmds: PaletteCommand[] = notes.map((n) => ({
      id: `note:${n.path}`,
      title: n.name.replace(/\.(md|canvas)$/, ""),
      subtitle: n.path,
      icon: FileText,
      category: "note",
      run: () => onOpenNote(n.path),
    }));
    const tagCmds: PaletteCommand[] = tags.map((t) => ({
      id: `tag:${t}`,
      title: `#${t}`,
      subtitle: "Tag",
      icon: Hash,
      category: "tag",
      run: () => onSelectTag(t),
    }));
    return [...commands, ...noteCmds, ...tagCmds];
  }, [commands, notes, tags, onOpenNote, onSelectTag]);

  const fuse = useMemo(
    () =>
      new Fuse(items, {
        keys: ["title", "subtitle", "keywords"],
        threshold: 0.4,
        includeScore: true,
      }),
    [items],
  );

  // ── Content (full-text) search ──────────────────────────────────
  /**
   * For each note in the cache, find the first few matches of the query
   * (case-insensitive substring) and produce a highlighted snippet.
   * The number of returned snippets per note is capped to keep the
   * result list scannable; note files with no matches return nothing.
   */
  const contentItems = useMemo<PaletteCommand[]>(() => {
    const q = query.trim();
    if (!q || q.length < 2 || !contentCache || contentCache.size === 0) return [];

    const needle = q.toLowerCase();
    const out: PaletteCommand[] = [];
    const PER_NOTE_CAP = 3;
    const TOTAL_CAP = 30;

    for (const [path, raw] of contentCache) {
      if (out.length >= TOTAL_CAP) break;
      if (!path.endsWith(".md")) continue;
      const hay = raw.toLowerCase();
      let from = 0;
      let perNote = 0;
      const title = path.split("/").pop()?.replace(/\.md$/, "") ?? path;

      while (perNote < PER_NOTE_CAP && out.length < TOTAL_CAP) {
        const i = hay.indexOf(needle, from);
        if (i === -1) break;

        // Build a ±60-char snippet around the match.
        const winStart = Math.max(0, i - 60);
        const winEnd = Math.min(raw.length, i + needle.length + 60);
        const snippet = raw.slice(winStart, winEnd);
        const matchOffsetInSnippet = i - winStart;

        // Compute 1-based line number of the match.
        const line = raw.slice(0, i).split("\n").length;

        const html =
          (winStart > 0 ? "…" : "") +
          escapeHtml(snippet.slice(0, matchOffsetInSnippet)) +
          `<mark class="trevor-match">${escapeHtml(
            snippet.slice(matchOffsetInSnippet, matchOffsetInSnippet + needle.length),
          )}</mark>` +
          escapeHtml(snippet.slice(matchOffsetInSnippet + needle.length)) +
          (winEnd < raw.length ? "…" : "");

        out.push({
          id: `content:${path}:${i}`,
          title,
          subtitle: `Line ${line} · ${path}`,
          icon: Quote,
          category: "content",
          snippetHtml: html,
          matchLine: line,
          notePath: path,
          run: () => onOpenNote(path, line),
        });

        from = i + needle.length;
        perNote += 1;
      }
    }
    return out;
  }, [query, contentCache, onOpenNote]);

  // ── Combined results list ───────────────────────────────────────
  const results = useMemo<PaletteCommand[]>(() => {
    if (!query.trim()) return items.slice(0, 50);
    const fuseHits = fuse.search(query).slice(0, 50).map((r) => r.item);
    return [...fuseHits, ...contentItems];
  }, [query, fuse, items, contentItems]);

  // ── Lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  // Keep the active row scrolled into view on keyboard nav.
  useEffect(() => {
    activeBtnRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = results[activeIndex];
        if (item) { item.run(); onClose(); }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [results, activeIndex, onClose],
  );

  if (!open) return null;

  // Group results by category for visual sectioning.
  const grouped = groupByCategory(results);
  const trimmedQuery = query.trim();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-trevor-bg-secondary border border-trevor-border rounded-xl shadow-elevation-2 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-trevor-border-subtle">
          <Search size={16} className="text-trevor-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search notes, tags, content, or run a command…"
            className="flex-1 bg-transparent text-[14px] text-trevor-text placeholder:text-trevor-text-muted outline-none"
          />
          <kbd className="text-[10px] font-mono text-trevor-text-muted px-1.5 py-0.5 border border-trevor-border rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[55vh] overflow-y-auto scrollbar-thin py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12.5px] text-trevor-text-muted">
              {trimmedQuery
                ? <>No matches for <span className="text-trevor-text">"{trimmedQuery}"</span></>
                : <>Start typing to search every note's title, body, and tags.</>
              }
            </div>
          ) : (
            (["command", "note", "tag", "content"] as const).map((cat) => {
              const group = grouped[cat];
              if (!group || group.length === 0) return null;
              const heading =
                cat === "command" ? "Commands"
                : cat === "note"  ? "Notes"
                : cat === "tag"   ? "Tags"
                : `Inside notes (${group.length})`;
              return (
                <div key={cat}>
                  <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-trevor-text-muted">
                    {heading}
                  </div>
                  {group.map((item) => {
                    const realIndex = results.indexOf(item);
                    const active = realIndex === activeIndex;
                    const Icon = item.icon ?? FileText;
                    return (
                      <button
                        ref={active ? activeBtnRef : undefined}
                        key={item.id}
                        onClick={() => { item.run(); onClose(); }}
                        onMouseMove={() => setActiveIndex(realIndex)}
                        className={`w-full flex items-start gap-3 px-4 py-2 text-left transition-colors ${
                          active ? "bg-trevor-surface-hover" : ""
                        }`}
                      >
                        <Icon
                          size={14}
                          className={`mt-0.5 flex-shrink-0 ${
                            active ? "text-trevor-accent" : "text-trevor-text-muted"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-trevor-text truncate">
                            {item.title}
                          </div>
                          {item.snippetHtml ? (
                            <div
                              className="text-[11.5px] text-trevor-text-muted mt-0.5 leading-snug line-clamp-2"
                              // The snippet HTML is built from escaped slices
                              // and a single <mark> tag; safe to inject.
                              dangerouslySetInnerHTML={{ __html: item.snippetHtml }}
                            />
                          ) : (
                            item.subtitle && (
                              <div className="text-[11px] text-trevor-text-muted truncate">
                                {item.subtitle}
                              </div>
                            )
                          )}
                          {item.snippetHtml && item.subtitle && (
                            <div className="text-[10.5px] text-trevor-text-muted truncate mt-0.5">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-trevor-border-subtle text-[10.5px] text-trevor-text-muted flex items-center justify-between">
          <span className="flex items-center gap-3">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
            {trimmedQuery && contentItems.length > 0 && (
              <span className="text-trevor-accent">{contentItems.length} content match{contentItems.length === 1 ? "" : "es"}</span>
            )}
          </span>
          <span>{results.length} result{results.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}

function groupByCategory(items: PaletteCommand[]): Record<string, PaletteCommand[]> {
  const out: Record<string, PaletteCommand[]> = {
    command: [], note: [], tag: [], content: [],
  };
  for (const item of items) out[item.category]?.push(item);
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Default commands ──────────────────────────────────────────── */

export function buildDefaultCommands(opts: {
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onCreateNote: () => void;
  onOpenVault?: () => void;
  onImportVault?: () => void;
  onExportVault?: () => void;
  onToggleToolbarPosition?: () => void;
}): PaletteCommand[] {
  const cmds: PaletteCommand[] = [
    {
      id: "cmd:new-note",
      title: "Create new note",
      subtitle: "Adds a blank note in your default folder",
      icon: Plus,
      category: "command",
      keywords: ["new", "create", "note", "add"],
      run: opts.onCreateNote,
    },
    {
      id: "cmd:open-settings",
      title: "Open settings",
      subtitle: "Customise theme, fonts, toolbar & behaviour",
      icon: SettingsIcon,
      category: "command",
      keywords: ["settings", "preferences", "config"],
      run: opts.onOpenSettings,
    },
    {
      id: "cmd:toggle-theme",
      title: "Toggle light / dark theme",
      icon: Sun,
      category: "command",
      keywords: ["theme", "dark", "light", "mode", "appearance"],
      run: opts.onToggleTheme,
    },
    {
      id: "cmd:dark-mode",
      title: "Switch to dark mode",
      icon: Moon,
      category: "command",
      keywords: ["dark", "night"],
      run: () => {
        const html = document.documentElement;
        html.setAttribute("data-theme", "trevor-dark");
        html.classList.remove("light");
      },
    },
  ];
  if (opts.onOpenVault) cmds.push({
    id: "cmd:open-vault",
    title: "Open another vault…",
    icon: FolderOpen,
    category: "command",
    keywords: ["vault", "open", "folder", "switch"],
    run: opts.onOpenVault,
  });
  if (opts.onImportVault) cmds.push({
    id: "cmd:import-vault",
    title: "Import vault bundle…",
    subtitle: "Add notes from a previously-exported .md bundle",
    icon: FolderOpen,
    category: "command",
    keywords: ["import", "bundle", "vault", "restore"],
    run: opts.onImportVault,
  });
  if (opts.onExportVault) cmds.push({
    id: "cmd:export-vault",
    title: "Export whole vault",
    subtitle: "Bundle every note into a single .md file",
    icon: FolderOpen,
    category: "command",
    keywords: ["export", "bundle", "backup"],
    run: opts.onExportVault,
  });
  if (opts.onToggleToolbarPosition) cmds.push({
    id: "cmd:toggle-toolbar-position",
    title: "Toggle toolbar position (top / bottom)",
    icon: SettingsIcon,
    category: "command",
    keywords: ["toolbar", "top", "bottom", "layout", "editor"],
    run: opts.onToggleToolbarPosition,
  });
  return cmds;
}
