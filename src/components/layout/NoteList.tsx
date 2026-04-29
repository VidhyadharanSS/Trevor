/**
 * Trevor — Note List Component (Middle Pane) — Phase 5+
 *
 * Displays notes in the selected folder, sorted by most recently modified.
 *
 * Multi-select model
 * ──────────────────
 * • A plain click selects a single note AND opens it in the editor.
 * • Cmd/Ctrl-click toggles a note's membership in the multi-selection
 *   without opening it. The first multi-clicked item becomes the
 *   "anchor" used by Shift-click range selection.
 * • Shift-click selects every note between the anchor and the clicked
 *   item, inclusive.
 * • Esc clears the multi-selection.
 *
 * Bulk action bar
 * ───────────────
 * Whenever ≥1 note is multi-selected, a sticky bar appears at the top
 * of the list with three actions:
 *   • Move to folder…  → opens MoveToFolderDialog
 *   • Pin / Unpin       → toggles the pin status for every selected note
 *   • Delete            → confirms then bulk-deletes
 *
 * Drag-and-drop
 * ─────────────
 * Multi-selected notes can be dragged onto any folder in the sidebar:
 * dataTransfer carries `application/x-trevor-paths` containing the
 * full JSON list of selected paths. The Sidebar's TreeItem honours
 * that payload and dispatches the bulk move via the host callbacks.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Clock, Star, StarOff,
  FolderInput, Trash2, X, CheckSquare, Square,
} from "lucide-react";
import { useVault } from "@/lib/store";
import { usePins } from "@/lib/pins/store";
import type { Note } from "@/lib/fs";

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface NoteListProps {
  onSelectNote: (path: string) => void;
  /** Bulk move handler implemented in AppLayout. */
  onBulkMove: (paths: string[], targetFolder: string) => Promise<void>;
  /** Bulk delete handler. */
  onBulkDelete: (paths: string[]) => Promise<void>;
  /** Open the move-to-folder dialog (parent owns the dialog). */
  onOpenMoveDialog: (paths: string[]) => void;
}

export function NoteList({
  onSelectNote, onBulkDelete, onOpenMoveDialog,
}: NoteListProps) {
  const { state } = useVault();
  const { notes, activeNotePath, noteListCollapsed, selectedFolder, vaultPath } = state;

  // Pin support — same anti-infinite-loop pattern as Sidebar.
  const pinsRecord = usePins((s) => s.pins);
  const togglePin = usePins((s) => s.togglePin);
  const pinned = useMemo<Set<string>>(
    () => new Set(vaultPath ? pinsRecord[vaultPath] ?? [] : []),
    [pinsRecord, vaultPath],
  );

  // Multi-selection state.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => b.modifiedAt - a.modifiedAt),
    [notes]
  );

  // When the active folder changes, drop any stale selection.
  useEffect(() => {
    setSelected(new Set());
    anchorRef.current = null;
  }, [selectedFolder]);

  // Esc clears the multi-selection if no other UI claims the key.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (selected.size > 0) {
        e.preventDefault();
        setSelected(new Set());
        anchorRef.current = null;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size]);

  const handleClick = useCallback(
    (e: React.MouseEvent, path: string, index: number) => {
      const meta = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;

      if (shift && anchorRef.current) {
        // Range select.
        const anchorIdx = sortedNotes.findIndex((n) => n.path === anchorRef.current);
        if (anchorIdx < 0) {
          setSelected(new Set([path]));
          anchorRef.current = path;
          return;
        }
        const [from, to] = anchorIdx <= index ? [anchorIdx, index] : [index, anchorIdx];
        const range = new Set<string>();
        for (let i = from; i <= to; i++) range.add(sortedNotes[i].path);
        setSelected(range);
        return;
      }

      if (meta) {
        // Toggle membership; do NOT open.
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        });
        anchorRef.current = path;
        return;
      }

      // Plain click → clear selection and open.
      setSelected(new Set());
      anchorRef.current = path;
      onSelectNote(path);
    },
    [onSelectNote, sortedNotes]
  );

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
      anchorRef.current = path;
    },
    [],
  );

  const selectAll = useCallback(() => {
    setSelected(new Set(sortedNotes.map((n) => n.path)));
  }, [sortedNotes]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    anchorRef.current = null;
  }, []);

  // Drag handler — package selected paths for sidebar drop targets.
  const handleDragStart = useCallback(
    (e: React.DragEvent, path: string) => {
      const paths = selected.size > 0 && selected.has(path) ? Array.from(selected) : [path];
      e.dataTransfer.setData("application/x-trevor-paths", JSON.stringify(paths));
      e.dataTransfer.setData("text/plain", paths[0]); // single-path fallback
      e.dataTransfer.effectAllowed = "move";
    },
    [selected],
  );

  const allPinned = useMemo(
    () => selected.size > 0 && Array.from(selected).every((p) => pinned.has(p)),
    [selected, pinned],
  );

  const handleBulkPinToggle = useCallback(() => {
    if (!vaultPath) return;
    // If all are pinned → unpin all; else pin the unpinned ones.
    for (const p of selected) {
      const isPinned = pinned.has(p);
      if (allPinned ? isPinned : !isPinned) togglePin(vaultPath, p);
    }
  }, [selected, vaultPath, pinned, allPinned, togglePin]);

  const handleBulkDelete = useCallback(async () => {
    if (selected.size === 0) return;
    const ok = window.confirm(
      `Delete ${selected.size} note${selected.size === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!ok) return;
    await onBulkDelete(Array.from(selected));
    clearSelection();
  }, [selected, onBulkDelete, clearSelection]);

  const handleBulkMove = useCallback(() => {
    if (selected.size === 0) return;
    onOpenMoveDialog(Array.from(selected));
  }, [selected, onOpenMoveDialog]);

  if (noteListCollapsed) return null;

  const folderName = selectedFolder === vaultPath
    ? "All Notes"
    : selectedFolder?.split("/").pop() ?? "Notes";

  return (
    <div className="app-notelist w-full h-full flex flex-col select-none border-r border-trevor-border">
      {/* Header */}
      <div className="h-[52px] flex items-end px-4 pb-2">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-[13px] font-semibold text-trevor-text">{folderName}</h2>
          <div className="flex items-center gap-2">
            {sortedNotes.length > 0 && (
              <button
                onClick={selected.size === sortedNotes.length ? clearSelection : selectAll}
                className="text-[11px] text-trevor-text-muted hover:text-trevor-text transition-colors"
                title={selected.size === sortedNotes.length ? "Clear selection" : "Select all"}
              >
                {selected.size === sortedNotes.length && sortedNotes.length > 0 ? "Clear" : "Select all"}
              </button>
            )}
            <span className="text-[11px] text-trevor-text-muted">{sortedNotes.length}</span>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="px-3 pb-2 animate-fade-in">
          <div className="flex items-center gap-1 px-2 py-1.5 bg-trevor-accent/10 border border-trevor-accent/30 rounded-md">
            <span className="text-[11.5px] font-medium text-trevor-accent flex-1">
              {selected.size} selected
            </span>
            <button
              onClick={handleBulkMove}
              className="p-1.5 rounded text-trevor-text hover:bg-trevor-surface-hover transition-colors"
              title="Move to folder…"
            >
              <FolderInput size={13} />
            </button>
            <button
              onClick={handleBulkPinToggle}
              className="p-1.5 rounded text-trevor-text hover:bg-trevor-surface-hover transition-colors"
              title={allPinned ? "Unpin selected" : "Pin selected"}
            >
              {allPinned ? <StarOff size={13} /> : <Star size={13} />}
            </button>
            <button
              onClick={handleBulkDelete}
              className="p-1.5 rounded text-trevor-danger hover:bg-trevor-danger/15 transition-colors"
              title="Delete selected"
            >
              <Trash2 size={13} />
            </button>
            <button
              onClick={clearSelection}
              className="p-1.5 rounded text-trevor-text-muted hover:bg-trevor-surface-hover transition-colors"
              title="Clear selection (Esc)"
            >
              <X size={13} />
            </button>
          </div>
          <p className="text-[10px] text-trevor-text-muted mt-1 px-1">
            ⌘-click to toggle · Shift-click for range
          </p>
        </div>
      )}

      {/* Note list */}
      <div className="flex-1 overflow-y-auto scrollbar-auto">
        {sortedNotes.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <FileText size={24} className="mx-auto mb-2 text-trevor-text-muted" />
            <p className="text-[13px] text-trevor-text-muted">No notes in this folder</p>
          </div>
        ) : (
          sortedNotes.map((note, idx) => (
            <NoteRow
              key={note.path}
              note={note}
              index={idx}
              isActive={note.path === activeNotePath && selected.size === 0}
              isSelected={selected.has(note.path)}
              isPinned={pinned.has(note.path)}
              hasAnySelection={selected.size > 0}
              onClick={handleClick}
              onCheckboxClick={handleCheckboxClick}
              onDragStart={handleDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ── NoteRow (memoised) ───────────────────────────────────────────────
 *
 * Memoised so re-renders triggered by unrelated state (e.g. typing in
 * the editor, ticking a pin elsewhere, the title bar updating) don't
 * re-render every row in folders with hundreds of notes. The custom
 * comparator only cares about the per-row props that affect appearance.
 */
interface NoteRowProps {
  note: Note;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  isPinned: boolean;
  hasAnySelection: boolean;
  onClick: (e: React.MouseEvent, path: string, index: number) => void;
  onCheckboxClick: (e: React.MouseEvent, path: string) => void;
  onDragStart: (e: React.DragEvent, path: string) => void;
}

const NoteRow = memo(function NoteRow({
  note, index, isActive, isSelected, isPinned, hasAnySelection,
  onClick, onCheckboxClick, onDragStart,
}: NoteRowProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, note.path)}
      onClick={(e) => onClick(e, note.path, index)}
      className={`
        w-full text-left px-4 py-3 border-b border-trevor-border-subtle
        transition-colors duration-75 cursor-pointer flex gap-2
        ${isSelected
          ? "bg-trevor-accent/15 hover:bg-trevor-accent/20"
          : isActive
          ? "bg-trevor-surface"
          : "hover:bg-trevor-bg-tertiary"
        }
      `}
    >
      {/* Selection checkbox */}
      <button
        onClick={(e) => onCheckboxClick(e, note.path)}
        className={`flex-shrink-0 mt-0.5 transition-colors ${
          isSelected
            ? "text-trevor-accent"
            : "text-trevor-text-muted hover:text-trevor-text opacity-0 group-hover:opacity-100"
        } ${hasAnySelection ? "opacity-100" : ""} group`}
        title={isSelected ? "Deselect" : "Select"}
      >
        {isSelected
          ? <CheckSquare size={14} />
          : <Square size={14} className={!hasAnySelection ? "opacity-50" : ""} />
        }
      </button>

      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <h3
            className={`text-[14px] font-medium truncate flex-1 ${
              isActive || isSelected ? "text-trevor-text" : "text-trevor-text-secondary"
            }`}
          >
            {note.title}
          </h3>
          {isPinned && (
            <Star size={10} className="text-trevor-warning fill-current flex-shrink-0" />
          )}
        </div>

        {/* Excerpt */}
        <p className="text-[12px] text-trevor-text-muted line-clamp-2 mb-1.5 leading-relaxed">
          {note.excerpt || "Empty note"}
        </p>

        {/* Timestamp */}
        <div className="flex items-center gap-1">
          <Clock size={10} className="text-trevor-text-muted" />
          <span className="text-[11px] text-trevor-text-muted">
            {formatRelativeTime(note.modifiedAt)}
          </span>
        </div>
      </div>
    </div>
  );
});
