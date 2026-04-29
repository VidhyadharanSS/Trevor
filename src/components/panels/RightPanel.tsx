/**
 * Trevor — Right Panel
 *
 * A toggleable right-hand pane showing per-note context:
 *   • Outline      — the active note's headings (jump on click)
 *   • Backlinks    — every other note that wiki-links to the active note
 *   • Forward-links — wiki-links the active note contains (with status)
 *   • History      — IndexedDB version history (restore on click)
 *
 * All panels operate on the in-memory content cache so they stay
 * in sync with edits.
 */
import { useMemo, useState } from "react";
import {
  ListTree, Link2, ArrowLeftRight, X, History as HistoryIcon, ChevronDown, ChevronRight,
} from "lucide-react";
import { buildOutline } from "@/lib/markdown/outline";
import { extractWikiLinks } from "@/lib/markdown/renderer";
import { HistoryPanel } from "./HistoryPanel";
import type { NoteVersion } from "@/lib/history";

interface RightPanelProps {
  open: boolean;
  onClose: () => void;
  activeNotePath: string | null;
  activeNoteContent: string;
  contentCache: Map<string, string>;
  /** Bumps whenever a save happens — used to refresh history. */
  historyRefreshKey: number;
  /** Called when user clicks a heading — pass back the line number to scroll to. */
  onJumpToLine?: (line: number) => void;
  /** Called when user clicks a backlink or wiki-link. */
  onOpenNote: (path: string) => void;
  /** Restore a previous version of the active note. */
  onRestoreVersion: (v: NoteVersion) => void;
  /** Preview a previous version (read-only). */
  onPreviewVersion: (v: NoteVersion) => void;
}

type SectionId = "outline" | "backlinks" | "forward" | "history";

export function RightPanel({
  open,
  onClose,
  activeNotePath,
  activeNoteContent,
  contentCache,
  historyRefreshKey,
  onJumpToLine,
  onOpenNote,
  onRestoreVersion,
  onPreviewVersion,
}: RightPanelProps) {
  // Track which sections are collapsed (default: all open).
  const [collapsed, setCollapsed] = useState<Set<SectionId>>(new Set());
  const toggle = (id: SectionId) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const outline = useMemo(
    () => (activeNoteContent ? buildOutline(activeNoteContent) : []),
    [activeNoteContent],
  );

  /** Notes that link to the active note via [[wiki-links]]. */
  const backlinks = useMemo(() => {
    if (!activeNotePath) return [];
    const targetTitle = activeNotePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
    if (!targetTitle) return [];
    const result: Array<{ path: string; snippet: string }> = [];
    for (const [path, content] of contentCache) {
      if (path === activeNotePath) continue;
      const re = new RegExp(`\\[\\[${escapeRe(targetTitle)}(?:\\|[^\\]]*)?\\]\\]`);
      const m = content.match(re);
      if (m && m.index !== undefined) {
        const start = Math.max(0, m.index - 30);
        const end = Math.min(content.length, m.index + m[0].length + 60);
        const snippet = content
          .slice(start, end)
          .replace(/\n+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        result.push({ path, snippet });
      }
    }
    return result;
  }, [activeNotePath, contentCache]);

  /** Wiki-links the active note contains, with resolution status. */
  const forwardLinks = useMemo(() => {
    if (!activeNoteContent) return [];
    const links = extractWikiLinks(activeNoteContent);
    const seen = new Set<string>();
    const unique = links.filter((l) => {
      const key = l.split("|")[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const titlesInVault = new Set<string>();
    for (const path of contentCache.keys()) {
      const t = path.split("/").pop()?.replace(/\.md$/, "");
      if (t) titlesInVault.add(t);
    }
    return unique.map((raw) => {
      const target = raw.split("|")[0];
      const display = raw.split("|").slice(1).join("|") || target;
      return { target, display, exists: titlesInVault.has(target) };
    });
  }, [activeNoteContent, contentCache]);

  if (!open) return null;

  return (
    <aside className="h-full flex flex-col bg-trevor-bg-secondary border-l border-trevor-border-strong flex-shrink-0 select-none w-[280px]">
      {/* Header */}
      <div className="h-[52px] flex items-end justify-between px-4 pb-2 border-b border-trevor-border-subtle">
        <h2 className="text-[13px] font-semibold text-trevor-text">Note details</h2>
        <button
          onClick={onClose}
          className="p-1 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover transition-colors"
          aria-label="Close panel"
        >
          <X size={14} />
        </button>
      </div>

      {!activeNotePath ? (
        <div className="flex-1 flex items-center justify-center text-[12px] text-trevor-text-muted px-4 text-center">
          Open a note to see its outline, backlinks, forward-links and history here.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Outline */}
          <Section id="outline" icon={ListTree} title="Outline" count={outline.length} collapsed={collapsed.has("outline")} onToggle={toggle}>
            {outline.length === 0 ? (
              <Empty>No headings in this note.</Empty>
            ) : (
              <ul className="py-1">
                {outline.map((h, i) => (
                  <li key={`${h.slug}-${i}`}>
                    <button
                      onClick={() => onJumpToLine?.(h.line)}
                      className="w-full text-left px-3 py-1 text-[12.5px] text-trevor-text-secondary hover:text-trevor-text hover:bg-trevor-surface-hover/50 transition-colors truncate"
                      style={{ paddingLeft: `${12 + (h.level - 1) * 12}px` }}
                      title={h.text}
                    >
                      <span className="text-trevor-text-muted text-[10px] mr-1">H{h.level}</span>
                      {h.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Backlinks */}
          <Section id="backlinks" icon={Link2} title="Backlinks" count={backlinks.length} collapsed={collapsed.has("backlinks")} onToggle={toggle}>
            {backlinks.length === 0 ? (
              <Empty>No notes link here yet.</Empty>
            ) : (
              <ul className="py-1">
                {backlinks.map((b) => {
                  const name = b.path.split("/").pop()?.replace(/\.md$/, "") ?? b.path;
                  return (
                    <li key={b.path}>
                      <button
                        onClick={() => onOpenNote(b.path)}
                        className="w-full text-left px-3 py-1.5 hover:bg-trevor-surface-hover/50 transition-colors"
                      >
                        <div className="text-[12.5px] text-trevor-text truncate">{name}</div>
                        <div className="text-[11px] text-trevor-text-muted line-clamp-1 mt-0.5">{b.snippet}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Forward links */}
          <Section id="forward" icon={ArrowLeftRight} title="Forward links" count={forwardLinks.length} collapsed={collapsed.has("forward")} onToggle={toggle}>
            {forwardLinks.length === 0 ? (
              <Empty>This note has no wiki-links yet.</Empty>
            ) : (
              <ul className="py-1">
                {forwardLinks.map((l) => (
                  <li key={l.target}>
                    <button
                      onClick={() => onOpenNote(l.target)}
                      className={`w-full text-left px-3 py-1 text-[12.5px] truncate transition-colors hover:bg-trevor-surface-hover/50 ${
                        l.exists ? "text-trevor-accent" : "text-trevor-warning"
                      }`}
                      title={l.exists ? "Open" : "Note doesn't exist yet — click to create"}
                    >
                      [[{l.display}]]
                      {!l.exists && (
                        <span className="ml-1 text-[10px] text-trevor-text-muted">new</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* History */}
          <Section id="history" icon={HistoryIcon} title="History" collapsed={collapsed.has("history")} onToggle={toggle}>
            <HistoryPanel
              activeNotePath={activeNotePath}
              refreshKey={historyRefreshKey}
              onRestore={onRestoreVersion}
              onPreview={onPreviewVersion}
            />
          </Section>
        </div>
      )}
    </aside>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function Section({
  id, icon: Icon, title, count, children, collapsed, onToggle,
}: {
  id: SectionId;
  icon: React.ElementType;
  title: string;
  count?: number;
  children: React.ReactNode;
  collapsed: boolean;
  onToggle: (id: SectionId) => void;
}) {
  return (
    <div className="border-b border-trevor-border-subtle">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-2 px-3 pt-3 pb-1.5 hover:bg-trevor-surface-hover/30 transition-colors"
      >
        {collapsed
          ? <ChevronRight size={11} className="text-trevor-text-muted" />
          : <ChevronDown size={11} className="text-trevor-text-muted" />
        }
        <Icon size={12} className="text-trevor-text-muted" />
        <span className="text-[10.5px] uppercase tracking-wider text-trevor-text-muted font-medium flex-1 text-left">
          {title}
        </span>
        {typeof count === "number" && (
          <span className="text-[10.5px] text-trevor-text-muted">{count}</span>
        )}
      </button>
      {!collapsed && children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-2 text-[11.5px] text-trevor-text-muted italic">
      {children}
    </p>
  );
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
