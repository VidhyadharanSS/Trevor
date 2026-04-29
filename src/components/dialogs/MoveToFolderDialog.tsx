/**
 * Trevor — Move-to-folder dialog
 *
 * Renders a list of every folder in the current vault and lets the user
 * pick a destination. Used by the bulk-action toolbar in NoteList.
 *
 * Folders are derived from the vault tree, indented by depth, with
 * the vault root listed first as "(Vault root)". A search filter
 * narrows the list as you type. Pressing Enter selects the highlighted
 * folder; Esc closes the dialog.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Folder, Search, X } from "lucide-react";
import type { FileEntry } from "@/lib/fs";

interface FolderOption {
  path: string;
  label: string;
  depth: number;
}

interface MoveToFolderDialogProps {
  open: boolean;
  vaultPath: string | null;
  tree: FileEntry[];
  /** Paths being moved — used to disable invalid destinations. */
  sourcePaths: string[];
  onPick: (folder: string) => void;
  onClose: () => void;
}

function flattenFolders(tree: FileEntry[], depth = 1): FolderOption[] {
  const out: FolderOption[] = [];
  for (const e of tree) {
    if (e.isDirectory) {
      out.push({ path: e.path, label: e.name, depth });
      if (e.children) out.push(...flattenFolders(e.children, depth + 1));
    }
  }
  return out;
}

export function MoveToFolderDialog({
  open, vaultPath, tree, sourcePaths, onPick, onClose,
}: MoveToFolderDialogProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allFolders = useMemo<FolderOption[]>(() => {
    const root: FolderOption[] = vaultPath
      ? [{ path: vaultPath, label: "(Vault root)", depth: 0 }]
      : [];
    return [...root, ...flattenFolders(tree)];
  }, [tree, vaultPath]);

  const sourceDirs = useMemo(() => {
    // For each source, compute its parent dir; can't move to that parent (no-op)
    const dirs = new Set<string>();
    for (const p of sourcePaths) {
      const idx = p.lastIndexOf("/");
      if (idx > 0) dirs.add(p.slice(0, idx));
    }
    return dirs;
  }, [sourcePaths]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allFolders.filter((f) => {
      // Prevent moving a folder into itself or its descendants.
      if (sourcePaths.some((sp) => f.path === sp || f.path.startsWith(sp + "/"))) {
        return false;
      }
      if (!q) return true;
      return f.label.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
    });
  }, [allFolders, query, sourcePaths]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  function pick(f: FolderOption) {
    if (sourceDirs.has(f.path)) return; // already there — silent no-op
    onPick(f.path);
  }

  return (
    <div
      className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="bg-trevor-bg-elevated border border-trevor-border rounded-xl shadow-elevation-2 w-[440px] max-h-[70vh] overflow-hidden flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-trevor-border-subtle flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-trevor-text">Move to folder</h3>
            <p className="text-[11px] text-trevor-text-muted">
              {sourcePaths.length} item{sourcePaths.length === 1 ? "" : "s"} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-trevor-surface-hover text-trevor-text-muted"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-trevor-border-subtle">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-trevor-bg rounded-lg border border-trevor-border-subtle focus-within:border-trevor-accent/50 transition-colors">
            <Search size={13} className="text-trevor-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(filtered.length - 1, h + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(0, h - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const f = filtered[highlight];
                  if (f) pick(f);
                } else if (e.key === "Escape") {
                  onClose();
                }
              }}
              placeholder="Search folders…"
              className="bg-transparent text-[13px] text-trevor-text placeholder:text-trevor-text-muted outline-none w-full"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-trevor-text-muted">
              No matching folders
            </div>
          ) : (
            filtered.map((f, i) => {
              const disabled = sourceDirs.has(f.path);
              const active = i === highlight;
              return (
                <button
                  key={f.path}
                  onClick={() => pick(f)}
                  disabled={disabled}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors ${
                    disabled
                      ? "opacity-40 cursor-not-allowed"
                      : active
                      ? "bg-trevor-surface-hover text-trevor-text"
                      : "text-trevor-text-secondary hover:bg-trevor-surface-hover hover:text-trevor-text"
                  }`}
                  style={{ paddingLeft: `${12 + f.depth * 14}px` }}
                  title={disabled ? "Already in this folder" : f.path}
                >
                  <Folder size={13} className="text-trevor-accent flex-shrink-0" />
                  <span className="truncate flex-1">{f.label}</span>
                  {disabled && (
                    <span className="text-[10px] text-trevor-text-muted">current</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="px-3 py-2 border-t border-trevor-border-subtle text-[11px] text-trevor-text-muted">
          ↑↓ to navigate · Enter to move · Esc to cancel
        </div>
      </div>
    </div>
  );
}
