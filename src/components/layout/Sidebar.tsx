/**
 * Trevor — Sidebar Component (Left Pane) — Phase 5
 *
 * Full-featured sidebar with:
 *   • Search across vault
 *   • Pinned notes section (Phase 5)
 *   • Folder tree with nested subfolder support
 *   • Create folder / subfolder / note actions
 *   • Right-click context menu (Pin / Rename / Delete)
 *   • Drag & drop for moving files between folders
 *   • Rename and delete operations
 *   • Bottom bar with Settings + Graph quick actions + note count
 */

import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  FileText,
  Settings,
  Network,
  Trash2,
  Edit2,
  X,
  Star,
  StarOff,
  Layout,
} from "lucide-react";
import { useVault } from "@/lib/store";
import type { FileEntry } from "@/lib/fs";
import { getFS } from "@/lib/fs";
import { usePins } from "@/lib/pins/store";
import { clearVersionsForPath, renameVersionPath } from "@/lib/history";
import { purgeFromHistory, renameInHistory } from "@/lib/history/note-history";

// ── Context Menu ───────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  entry: FileEntry;
}

// ── Tree Item Component ────────────────────────────

interface TreeItemProps {
  entry: FileEntry;
  depth: number;
  selectedPath: string | null;
  activeNotePath: string | null;
  expandedFolders: Set<string>;
  pinned: Set<string>;
  onSelectFolder: (path: string) => void;
  onSelectNote: (path: string) => void;
  onToggleFolder: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onDragStart: (path: string) => void;
  onDrop: (targetDir: string, externalPaths?: string[]) => void;
  dragOverPath: string | null;
  onDragOver: (path: string | null) => void;
}

function TreeItem({
  entry, depth, selectedPath, activeNotePath, expandedFolders, pinned,
  onSelectFolder, onSelectNote, onToggleFolder, onContextMenu,
  onDragStart, onDrop, dragOverPath, onDragOver,
}: TreeItemProps) {
  const isSelected = entry.path === selectedPath || entry.path === activeNotePath;
  const isFolder = entry.isDirectory;
  const isCanvas = !isFolder && entry.name.endsWith(".canvas");
  const isMarkdown = !isFolder && entry.name.endsWith(".md");
  const isExpanded = expandedFolders.has(entry.path);
  const hasChildren = entry.children && entry.children.length > 0;
  const isDragOver = dragOverPath === entry.path && isFolder;
  const isPinned = pinned.has(entry.path);

  const handleClick = useCallback(() => {
    if (isFolder) {
      onToggleFolder(entry.path);
      onSelectFolder(entry.path);
    } else if (isMarkdown || isCanvas) {
      onSelectNote(entry.path);
    }
  }, [isFolder, isMarkdown, isCanvas, entry.path, onSelectFolder, onSelectNote, onToggleFolder]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      // Sidebar drags carry both formats so they interop with NoteList drops.
      e.dataTransfer.setData("application/x-trevor-paths", JSON.stringify([entry.path]));
      e.dataTransfer.setData("text/plain", entry.path);
      e.dataTransfer.effectAllowed = "move";
      onDragStart(entry.path);
    },
    [entry.path, onDragStart]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (isFolder) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(entry.path);
      }
    },
    [isFolder, entry.path, onDragOver]
  );

  const handleDragLeave = useCallback(() => onDragOver(null), [onDragOver]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isFolder) {
        // Prefer multi-path payload from NoteList; fall back to single-source.
        const raw = e.dataTransfer.getData("application/x-trevor-paths");
        if (raw) {
          try {
            const paths = JSON.parse(raw) as string[];
            if (Array.isArray(paths) && paths.length > 0) {
              onDrop(entry.path, paths);
              onDragOver(null);
              return;
            }
          } catch { /* fall through */ }
        }
        onDrop(entry.path);
      }
      onDragOver(null);
    },
    [isFolder, entry.path, onDrop, onDragOver]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu(e, entry);
    },
    [entry, onContextMenu]
  );

  return (
    <div>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          w-full flex items-center gap-1.5 px-2 py-[5px] rounded-md text-[13px]
          transition-colors duration-75 group
          ${isDragOver
            ? "bg-trevor-accent/20 border border-trevor-accent border-dashed"
            : isSelected
              ? "bg-trevor-surface text-trevor-text"
              : "text-trevor-text-secondary hover:bg-trevor-surface-hover hover:text-trevor-text"
          }
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse indicator for folders */}
        {isFolder ? (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {isExpanded
              ? <ChevronDown size={12} className="text-trevor-text-muted" />
              : <ChevronRight size={12} className="text-trevor-text-muted" />
            }
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Icon */}
        {isFolder ? (
          isExpanded
            ? <FolderOpen size={14} className="text-trevor-accent flex-shrink-0" />
            : <Folder size={14} className="text-trevor-text-muted flex-shrink-0" />
        ) : isCanvas ? (
          <Layout size={14} className="text-trevor-info flex-shrink-0" />
        ) : (
          <FileText size={14} className="text-trevor-text-muted flex-shrink-0" />
        )}

        {/* Name */}
        <span className="truncate flex-1 text-left">
          {isFolder ? entry.name : entry.name.replace(/\.(md|canvas)$/, "")}
        </span>

        {/* Pin / count indicator */}
        {isPinned && !isFolder && (
          <Star size={10} className="text-trevor-warning flex-shrink-0 fill-current" />
        )}
        {isFolder && entry.children && entry.children.length > 0 && (
          <span className="text-[10px] text-trevor-text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {entry.children.filter((c) => /\.(md|canvas)$/.test(c.name) || c.isDirectory).length}
          </span>
        )}
      </button>

      {/* Render children if expanded */}
      {isFolder && isExpanded && hasChildren && (
        <div className="animate-fade-in">
          {entry.children!.map((child) => (
            <TreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              activeNotePath={activeNotePath}
              expandedFolders={expandedFolders}
              pinned={pinned}
              onSelectFolder={onSelectFolder}
              onSelectNote={onSelectNote}
              onToggleFolder={onToggleFolder}
              onContextMenu={onContextMenu}
              onDragStart={onDragStart}
              onDrop={onDrop}
              dragOverPath={dragOverPath}
              onDragOver={onDragOver}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar Component ──────────────────────────────

interface SidebarProps {
  onSelectFolder: (path: string) => void;
  onSelectNote: (path: string) => void;
  onRefreshTree: () => Promise<void>;
  onOpenSettings?: () => void;
  onOpenGraph?: () => void;
}

export function Sidebar({
  onSelectFolder, onSelectNote, onRefreshTree, onOpenSettings, onOpenGraph,
}: SidebarProps) {
  const { state, dispatch } = useVault();
  const { tree, selectedFolder, vaultPath, sidebarCollapsed, expandedFolders, searchQuery, activeNotePath } = state;

  // Select only the raw record — its reference is stable across renders unless
  // it actually changes. Deriving the per-vault array via useMemo prevents
  // the "selector returns new reference every render" infinite loop that
  // crashes React with "Maximum update depth exceeded".
  const pinsRecord = usePins((s) => s.pins);
  const togglePin = usePins((s) => s.togglePin);
  const renamePinned = usePins((s) => s.renamePinned);
  const removePinned = usePins((s) => s.removePinned);
  const pinsForVault = useMemo<string[]>(
    () => (vaultPath ? pinsRecord[vaultPath] ?? [] : []),
    [pinsRecord, vaultPath],
  );

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isCreating, setIsCreating] = useState<"file" | "folder" | "canvas" | null>(null);
  const [createParentPath, setCreateParentPath] = useState<string>("");
  const [newItemName, setNewItemName] = useState("");
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState("");

  const createInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCreating && createInputRef.current) createInputRef.current.focus();
  }, [isCreating]);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [contextMenu]);

  const handleToggleFolder = useCallback(
    (path: string) => dispatch({ type: "TOGGLE_FOLDER", path }),
    [dispatch]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: FileEntry) => {
      setContextMenu({ x: e.clientX, y: e.clientY, entry });
    },
    []
  );

  const startCreate = useCallback(
    (kind: "file" | "folder" | "canvas", parentPath: string) => {
      setIsCreating(kind);
      setCreateParentPath(parentPath);
      setNewItemName("");
      setContextMenu(null);
      dispatch({ type: "EXPAND_FOLDER", path: parentPath });
    },
    [dispatch]
  );

  const handleCreateSubmit = useCallback(async () => {
    if (!newItemName.trim()) {
      setIsCreating(null);
      return;
    }
    try {
      const fs = await getFS();
      if (isCreating === "folder") {
        await fs.createDir(`${createParentPath}/${newItemName.trim()}`);
      } else if (isCreating === "file") {
        let fname = newItemName.trim();
        if (!fname.endsWith(".md")) fname += ".md";
        const filePath = `${createParentPath}/${fname}`;
        await fs.writeFile(filePath, `# ${fname.replace(/\.md$/, "")}\n\n`);
      } else if (isCreating === "canvas") {
        let fname = newItemName.trim();
        if (!fname.endsWith(".canvas")) fname += ".canvas";
        const filePath = `${createParentPath}/${fname}`;
        await fs.writeFile(filePath, JSON.stringify({ nodes: [], edges: [] }, null, 2));
      }
      await onRefreshTree();
      setIsCreating(null);
      setNewItemName("");
    } catch (err) {
      console.error("Failed to create item:", err);
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Failed to create item",
      });
    }
  }, [newItemName, isCreating, createParentPath, onRefreshTree, dispatch]);

  const startRename = useCallback((entry: FileEntry) => {
    setIsRenaming(entry.path);
    setRenameValue(entry.isDirectory ? entry.name : entry.name.replace(/\.(md|canvas)$/, ""));
    setContextMenu(null);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!isRenaming || !renameValue.trim()) {
      setIsRenaming(null);
      return;
    }
    try {
      const fs = await getFS();
      const parts = isRenaming.split("/");
      parts.pop();
      const parentDir = parts.join("/");

      const exists = await fs.exists(isRenaming);
      if (!exists) {
        setIsRenaming(null);
        return;
      }

      let newName = renameValue.trim();
      const oldExt = isRenaming.match(/\.(md|canvas)$/)?.[0];
      if (oldExt && !newName.endsWith(oldExt)) newName += oldExt;

      const newPath = `${parentDir}/${newName}`;
      await fs.rename(isRenaming, newPath);

      // Sync subsystems.
      if (vaultPath) {
        renamePinned(vaultPath, isRenaming, newPath);
        renameInHistory(vaultPath, isRenaming, newPath);
      }
      if (oldExt === ".md") await renameVersionPath(isRenaming, newPath);

      if (state.activeNotePath === isRenaming) {
        dispatch({ type: "UPDATE_NOTE_PATH", oldPath: isRenaming, newPath });
      }

      await onRefreshTree();
      if (selectedFolder) onSelectFolder(selectedFolder);
    } catch (err) {
      console.error("Failed to rename:", err);
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Failed to rename",
      });
    }
    setIsRenaming(null);
  }, [isRenaming, renameValue, state.activeNotePath, selectedFolder, vaultPath, renamePinned, onRefreshTree, onSelectFolder, dispatch]);

  const handleDelete = useCallback(
    async (entry: FileEntry) => {
      setContextMenu(null);
      const confirmMsg = entry.isDirectory
        ? `Delete folder "${entry.name}" and all its contents?`
        : `Delete "${entry.name}"?`;
      if (!window.confirm(confirmMsg)) return;

      try {
        const fs = await getFS();
        await fs.remove(entry.path);

        // Sync history + pins.
        if (vaultPath) {
          removePinned(vaultPath, entry.path);
          purgeFromHistory(vaultPath, entry.path);
        }
        if (entry.path.endsWith(".md")) {
          try { await clearVersionsForPath(entry.path); } catch { /* ignore */ }
        }

        if (state.activeNotePath === entry.path) {
          dispatch({ type: "CLOSE_NOTE" });
        }

        await onRefreshTree();
        if (selectedFolder) onSelectFolder(selectedFolder);
      } catch (err) {
        console.error("Failed to delete:", err);
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : "Failed to delete",
        });
      }
    },
    [state.activeNotePath, selectedFolder, vaultPath, removePinned, onRefreshTree, onSelectFolder, dispatch]
  );

  const handleTogglePin = useCallback(
    (entry: FileEntry) => {
      if (!vaultPath || entry.isDirectory) return;
      togglePin(vaultPath, entry.path);
      setContextMenu(null);
    },
    [vaultPath, togglePin]
  );

  // ── Drag and Drop ──
  const handleDragStart = useCallback((path: string) => setDragSourcePath(path), []);

  /** Move one or many sources into a target directory. */
  const moveMany = useCallback(
    async (sources: string[], targetDir: string) => {
      const fs = await getFS();
      let activeRemap: { from: string; to: string } | null = null;

      for (const src of sources) {
        if (src === targetDir) continue;
        if (targetDir.startsWith(src + "/")) continue; // can't move into self
        const parent = src.slice(0, src.lastIndexOf("/"));
        if (parent === targetDir) continue;            // already there

        try {
          const newPath = await fs.moveItem(src, targetDir);
          if (vaultPath) {
            renamePinned(vaultPath, src, newPath);
            renameInHistory(vaultPath, src, newPath);
          }
          if (src.endsWith(".md")) {
            try { await renameVersionPath(src, newPath); } catch { /* ignore */ }
          }
          if (state.activeNotePath === src) activeRemap = { from: src, to: newPath };
        } catch (err) {
          console.error(`Failed to move ${src}:`, err);
          dispatch({
            type: "SET_ERROR",
            error: err instanceof Error ? err.message : `Failed to move ${src}`,
          });
        }
      }

      if (activeRemap) {
        dispatch({ type: "UPDATE_NOTE_PATH", oldPath: activeRemap.from, newPath: activeRemap.to });
      }

      await onRefreshTree();
      if (selectedFolder) onSelectFolder(selectedFolder);
    },
    [vaultPath, renamePinned, state.activeNotePath, onRefreshTree, selectedFolder, onSelectFolder, dispatch],
  );

  const handleDrop = useCallback(
    async (targetDir: string, externalPaths?: string[]) => {
      const sources = externalPaths && externalPaths.length > 0
        ? externalPaths
        : (dragSourcePath ? [dragSourcePath] : []);
      setDragSourcePath(null);
      setDragOverPath(null);
      if (sources.length === 0) return;
      await moveMany(sources, targetDir);
    },
    [dragSourcePath, moveMany]
  );

  // ── Search ──
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalSearch(e.target.value);
      dispatch({ type: "SET_SEARCH_QUERY", query: e.target.value });
    },
    [dispatch]
  );

  const clearSearch = useCallback(() => {
    setLocalSearch("");
    dispatch({ type: "SET_SEARCH_QUERY", query: "" });
  }, [dispatch]);

  const filterTree = useCallback(
    (entries: FileEntry[], query: string): FileEntry[] => {
      if (!query.trim()) return entries;
      const q = query.toLowerCase();

      return entries.reduce<FileEntry[]>((acc, entry) => {
        if (entry.isDirectory) {
          const filteredChildren = entry.children
            ? filterTree(entry.children, query)
            : [];
          if (filteredChildren.length > 0 || entry.name.toLowerCase().includes(q)) {
            acc.push({ ...entry, children: filteredChildren });
          }
        } else if (entry.name.toLowerCase().includes(q)) {
          acc.push(entry);
        }
        return acc;
      }, []);
    },
    []
  );

  if (sidebarCollapsed) return null;

  const vaultName = vaultPath?.split("/").pop() ?? "Vault";
  const displayTree = searchQuery ? filterTree(tree, searchQuery) : tree;

  // Memoise pin lookups so reference identity is stable when nothing changed.
  const pinnedSet = useMemo(() => new Set(pinsForVault), [pinsForVault]);
  const pinnedEntries = useMemo<FileEntry[]>(() => {
    const acc: FileEntry[] = [];
    const walk = (entries: FileEntry[]) => {
      for (const e of entries) {
        if (!e.isDirectory && pinnedSet.has(e.path)) acc.push(e);
        if (e.children) walk(e.children);
      }
    };
    walk(tree);
    return acc;
  }, [tree, pinnedSet]);

  return (
    <aside className="app-sidebar w-full h-full flex flex-col select-none flex-shrink-0 border-r border-trevor-border-strong">
      {/* Top spacing for macOS traffic lights */}
      <div className="h-[52px] flex items-end px-3 pb-2 flex-shrink-0">
        <h1 className="text-[13px] font-semibold text-trevor-text tracking-tight flex-1 truncate">
          {vaultName}
        </h1>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-trevor-bg rounded-lg border border-trevor-border-subtle focus-within:border-trevor-accent/50 transition-colors">
          <Search size={14} className="text-trevor-text-muted flex-shrink-0" />
          <input
            type="text"
            value={localSearch}
            onChange={handleSearchChange}
            placeholder="Search notes…"
            className="bg-transparent text-[13px] text-trevor-text placeholder:text-trevor-text-muted outline-none w-full"
          />
          {localSearch && (
            <button onClick={clearSearch} className="flex-shrink-0 text-trevor-text-muted hover:text-trevor-text">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-3 pb-2 flex flex-wrap gap-1 flex-shrink-0">
        <QuickAction
          icon={FilePlus} label="Note"
          onClick={() => startCreate("file", selectedFolder ?? vaultPath ?? "")}
        />
        <QuickAction
          icon={Layout} label="Canvas"
          onClick={() => startCreate("canvas", selectedFolder ?? vaultPath ?? "")}
        />
        <QuickAction
          icon={FolderPlus} label="Folder"
          onClick={() => startCreate("folder", selectedFolder ?? vaultPath ?? "")}
        />
        <QuickAction
          icon={Network} label="Graph"
          onClick={() => onOpenGraph?.()}
        />
      </div>

      {/* Inline Create Input */}
      {isCreating && (
        <div className="px-3 pb-2 flex-shrink-0 animate-fade-in">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-trevor-surface rounded-lg border border-trevor-accent/50">
            {isCreating === "folder"
              ? <FolderPlus size={14} className="text-trevor-accent flex-shrink-0" />
              : isCreating === "canvas"
                ? <Layout size={14} className="text-trevor-accent flex-shrink-0" />
                : <FilePlus size={14} className="text-trevor-accent flex-shrink-0" />
            }
            <input
              ref={createInputRef}
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSubmit();
                if (e.key === "Escape") {
                  setIsCreating(null);
                  setNewItemName("");
                }
              }}
              onBlur={handleCreateSubmit}
              placeholder={
                isCreating === "folder"
                  ? "Folder name…"
                  : isCreating === "canvas"
                    ? "Canvas name…"
                    : "Note name…"
              }
              className="bg-transparent text-[13px] text-trevor-text placeholder:text-trevor-text-muted outline-none w-full"
            />
          </div>
          <p className="text-[10px] text-trevor-text-muted mt-1 px-1">
            in {createParentPath.split("/").pop()}/ — Enter to create, Esc to cancel
          </p>
        </div>
      )}

      {/* Pinned section */}
      {pinnedEntries.length > 0 && !searchQuery && (
        <div className="px-1.5 pb-1 flex-shrink-0">
          <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-trevor-text-muted font-medium flex items-center gap-1.5">
            <Star size={10} className="text-trevor-warning fill-current" />
            Pinned
          </div>
          {pinnedEntries.map((entry) => (
            <TreeItem
              key={`pin:${entry.path}`}
              entry={entry}
              depth={0}
              selectedPath={selectedFolder}
              activeNotePath={activeNotePath}
              expandedFolders={expandedFolders}
              pinned={pinnedSet}
              onSelectFolder={onSelectFolder}
              onSelectNote={onSelectNote}
              onToggleFolder={handleToggleFolder}
              onContextMenu={handleContextMenu}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              dragOverPath={dragOverPath}
              onDragOver={setDragOverPath}
            />
          ))}
          <div className="border-t border-trevor-border-subtle my-1.5 mx-2.5" />
        </div>
      )}

      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto scrollbar-auto px-1.5 pb-4 min-h-0">
        {displayTree.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-[13px] text-trevor-text-muted">
              {searchQuery ? "No matching notes" : "No notes yet. Create your first note!"}
            </p>
          </div>
        ) : (
          displayTree.map((entry) => (
            <TreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              selectedPath={selectedFolder}
              activeNotePath={activeNotePath}
              expandedFolders={expandedFolders}
              pinned={pinnedSet}
              onSelectFolder={onSelectFolder}
              onSelectNote={onSelectNote}
              onToggleFolder={handleToggleFolder}
              onContextMenu={handleContextMenu}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              dragOverPath={dragOverPath}
              onDragOver={setDragOverPath}
            />
          ))
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-trevor-border px-3 py-2 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => onOpenSettings?.()}
          className="p-1.5 rounded-md text-trevor-text-muted hover:bg-trevor-surface-hover hover:text-trevor-text transition-colors"
          title="Settings (⌘,)"
        >
          <Settings size={14} />
        </button>
        <span className="text-[11px] text-trevor-text-muted">
          {countNotes(tree)} notes
        </span>
      </div>

      {/* Context Menu (Portal) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[9999] bg-trevor-surface border border-trevor-border rounded-lg shadow-2xl py-1 min-w-[200px] animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.entry.isDirectory ? (
            <>
              <ContextMenuItem
                icon={FilePlus} label="New Note Here"
                onClick={() => startCreate("file", contextMenu.entry.path)}
              />
              <ContextMenuItem
                icon={Layout} label="New Canvas Here"
                onClick={() => startCreate("canvas", contextMenu.entry.path)}
              />
              <ContextMenuItem
                icon={FolderPlus} label="New Subfolder"
                onClick={() => startCreate("folder", contextMenu.entry.path)}
              />
              <div className="h-px bg-trevor-border my-1" />
            </>
          ) : (
            <>
              <ContextMenuItem
                icon={pinnedSet.has(contextMenu.entry.path) ? StarOff : Star}
                label={pinnedSet.has(contextMenu.entry.path) ? "Unpin" : "Pin to top"}
                onClick={() => handleTogglePin(contextMenu.entry)}
              />
              <div className="h-px bg-trevor-border my-1" />
            </>
          )}
          <ContextMenuItem
            icon={Edit2} label="Rename"
            onClick={() => startRename(contextMenu.entry)}
          />
          <ContextMenuItem
            icon={Trash2} label="Delete"
            onClick={() => handleDelete(contextMenu.entry)}
            danger
          />
        </div>
      )}

      {/* Rename Modal */}
      {isRenaming && (
        <div className="fixed inset-0 z-[9998] bg-black/50 flex items-center justify-center">
          <div className="bg-trevor-surface border border-trevor-border rounded-xl p-5 w-[320px] shadow-2xl animate-fade-in">
            <h3 className="text-[14px] font-semibold text-trevor-text mb-3">Rename</h3>
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setIsRenaming(null);
              }}
              className="w-full px-3 py-2 bg-trevor-bg border border-trevor-border rounded-lg text-[13px] text-trevor-text outline-none focus:border-trevor-accent/50"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setIsRenaming(null)}
                className="px-3 py-1.5 text-[13px] text-trevor-text-secondary hover:text-trevor-text rounded-md hover:bg-trevor-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                className="px-3 py-1.5 text-[13px] bg-trevor-accent text-white rounded-md hover:bg-trevor-accent-hover transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

/* ── Atoms ─────────────────────────────────────────────────────────── */

function QuickAction({
  icon: Icon, label, onClick,
}: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] text-trevor-text-secondary hover:bg-trevor-surface-hover hover:text-trevor-text transition-colors"
      title={label}
    >
      <Icon size={13} />
      <span>{label}</span>
    </button>
  );
}

function ContextMenuItem({
  icon: Icon, label, onClick, danger = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors ${
        danger
          ? "text-trevor-danger hover:bg-trevor-danger/10"
          : "text-trevor-text-secondary hover:bg-trevor-surface-hover hover:text-trevor-text"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function countNotes(entries: FileEntry[]): number {
  let count = 0;
  for (const e of entries) {
    if (!e.isDirectory && e.name.endsWith(".md")) count++;
    if (e.children) count += countNotes(e.children);
  }
  return count;
}
