/**
 * Trevor — App Layout Orchestrator (Phase 5)
 *
 * Wires together every primary surface:
 *   • Sidebar  ⟷ NoteList ⟷ EditorPane ⟷ RightPanel
 *   • Settings page                       (modal)
 *   • Command Palette                     (⌘K spotlight)
 *   • Graph View                          (force-directed)
 *   • Canvas View                         (JSON Canvas whiteboard) — Phase 5
 *   • Tag Manager                         (filters note list)
 *   • Pomodoro Timer                      (focus widget)         — Phase 5
 *   • Shortcuts Help dialog               (⌘/)                    — Phase 5
 *   • Note History                        (IndexedDB + Right Panel) — Phase 5
 *   • Pinned notes                        (Sidebar)              — Phase 5
 *   • Multi-format Export                 (PDF/HTML/MD/Bundle)   — Phase 5
 *
 * Vault content cache: we lazily read every .md file once so the
 * Command Palette, Graph view, and tag filter all share data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVault } from "@/lib/store";
import { getFS, buildExcerpt } from "@/lib/fs";
import type { FileEntry, Note } from "@/lib/fs";
import { Sidebar } from "./Sidebar";
import { NoteList } from "./NoteList";
import { EditorPane } from "./EditorPane";
import { TitleBar } from "./TitleBar";
import { SettingsPage } from "@/components/settings/SettingsPage";
import {
  CommandPalette,
  buildDefaultCommands,
} from "@/components/command/CommandPalette";
import { GraphView } from "@/components/graph/GraphView";
import { CanvasView } from "@/components/canvas/CanvasView";
import { ShortcutsHelp } from "@/components/help/ShortcutsHelp";
import { PomodoroTimer } from "@/components/focus/PomodoroTimer";
import { buildGraph, collectAllTags } from "@/lib/graph";
import { useSettings } from "@/lib/settings/store";
import { TagManager } from "@/components/tags/TagManager";
import { RightPanel } from "@/components/panels/RightPanel";
import { buildTagIndex, noteHasTag } from "@/lib/tags";
import type { TreeNode } from "@/lib/fs/types";
import { pushVersion, type NoteVersion } from "@/lib/history";
import {
  exportNoteAsHtml, exportNoteAsMarkdown, exportVaultAsBundle,
  parseVaultBundle,
} from "@/lib/export";
import { renderMarkdown } from "@/lib/markdown/renderer";
import { noteTitle } from "@/lib/fs";
import { MoveToFolderDialog } from "@/components/dialogs/MoveToFolderDialog";
import { usePins } from "@/lib/pins/store";
import { clearVersionsForPath, renameVersionPath } from "@/lib/history";
import { pLimit, keyedMutex } from "@/lib/util/concurrency";
import {
  pushVisit, navigateBack, navigateForward,
  purgeFromHistory, renameInHistory, getLastNote,
} from "@/lib/history/note-history";

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 480;
const NOTELIST_MIN = 220;
const NOTELIST_MAX = 480;

/* ── Tree helpers ─────────────────────────────────────────────────── */

function collectNotesInFolder(tree: FileEntry[], folderPath: string): FileEntry[] {
  function findFolder(entries: FileEntry[], target: string): FileEntry[] | null {
    for (const e of entries) {
      if (e.path === target && e.isDirectory) return e.children ?? [];
      if (e.isDirectory && e.children) {
        const found = findFolder(e.children, target);
        if (found) return found;
      }
    }
    return null;
  }
  const children = findFolder(tree, folderPath);
  if (!children) return [];
  return children.filter((e) => !e.isDirectory && e.name.endsWith(".md"));
}

function collectAllNotes(tree: FileEntry[]): FileEntry[] {
  const result: FileEntry[] = [];
  function walk(entries: FileEntry[]) {
    for (const e of entries) {
      if (!e.isDirectory && e.name.endsWith(".md")) result.push(e);
      else if (e.isDirectory && e.children) walk(e.children);
    }
  }
  walk(tree);
  return result;
}

function collectAllCanvases(tree: FileEntry[]): FileEntry[] {
  const result: FileEntry[] = [];
  function walk(entries: FileEntry[]) {
    for (const e of entries) {
      if (!e.isDirectory && e.name.endsWith(".canvas")) result.push(e);
      else if (e.isDirectory && e.children) walk(e.children);
    }
  }
  walk(tree);
  return result;
}

function findNoteByTitle(tree: FileEntry[], title: string): FileEntry | null {
  function walk(entries: FileEntry[]): FileEntry | null {
    for (const e of entries) {
      if (!e.isDirectory && e.name.endsWith(".md")) {
        if (e.name.replace(/\.md$/, "") === title) return e;
      }
      if (e.isDirectory && e.children) {
        const found = walk(e.children);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(tree);
}

function toTreeNode(entry: FileEntry): TreeNode {
  return {
    name: entry.name,
    path: entry.path,
    kind: entry.isDirectory ? "folder" : "file",
    children: entry.children?.map(toTreeNode),
  };
}

/* ── Component ────────────────────────────────────────────────────── */

export function AppLayout() {
  const { state, dispatch } = useVault();
  const settings = useSettings((s) => s.settings);
  const setSetting = useSettings((s) => s.set);

  // ── Pane sizes ────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("trevor:sidebarWidth");
    return saved ? clamp(parseInt(saved, 10), SIDEBAR_MIN, SIDEBAR_MAX) : 260;
  });
  const [noteListWidth, setNoteListWidth] = useState(() => {
    const saved = localStorage.getItem("trevor:noteListWidth");
    return saved ? clamp(parseInt(saved, 10), NOTELIST_MIN, NOTELIST_MAX) : 300;
  });
  useEffect(() => localStorage.setItem("trevor:sidebarWidth", String(sidebarWidth)), [sidebarWidth]);
  useEffect(() => localStorage.setItem("trevor:noteListWidth", String(noteListWidth)), [noteListWidth]);

  // ── Modal / overlay state ─────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPomodoro, setShowPomodoro] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(() => {
    const saved = localStorage.getItem("trevor:rightPanelOpen");
    return saved == null ? true : saved === "1";
  });
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [previewVersion, setPreviewVersion] = useState<NoteVersion | null>(null);

  // Bulk-move dialog
  const [moveTargets, setMoveTargets] = useState<string[] | null>(null);

  // External-change banner — shown when the FS watcher reports the
  // active note changed on disk and it diverges from the in-memory buffer.
  const [externalChange, setExternalChange] = useState<null | { content: string }>(null);

  // Pin store sync hooks (for cleanup on bulk delete/move).
  const renamePinned = usePins((s) => s.renamePinned);
  const removePinned = usePins((s) => s.removePinned);

  // Active canvas (when set, replaces the editor pane).
  const [activeCanvasPath, setActiveCanvasPath] = useState<string | null>(null);
  const [activeCanvasContent, setActiveCanvasContent] = useState<string>("");

  useEffect(
    () => localStorage.setItem("trevor:rightPanelOpen", showRightPanel ? "1" : "0"),
    [showRightPanel],
  );

  // ── Vault-wide content cache  (path → markdown text) ──
  // Uses a *diff-based* loader so re-opening a vault or refreshing the
  // tree only fetches paths we don't already have, instead of re-reading
  // every file from disk. Concurrency is capped via pLimit so vaults
  // with thousands of notes don't open a thousand file handles at once.
  const [contentCache, setContentCache] = useState<Map<string, string>>(new Map());
  const cacheRef = useRef(contentCache);
  cacheRef.current = contentCache;
  const readLimitRef = useRef(pLimit(8));
  // Per-path save mutex so two saves to the same note can never race.
  const saveLockRef = useRef(keyedMutex());

  useEffect(() => {
    if (!state.vaultPath || state.tree.length === 0) return;
    let cancelled = false;
    (async () => {
      const fs = await getFS();
      const allNotes = collectAllNotes(state.tree);
      const allPaths = new Set(allNotes.map((n) => n.path));
      const previous = cacheRef.current;

      // Pure-add path: keep entries that are still present, remove vanished
      // ones, and load anything that's new with bounded parallelism.
      const next = new Map<string, string>();
      for (const [p, c] of previous) {
        if (allPaths.has(p)) next.set(p, c);
      }
      const missing = allNotes.filter((n) => !next.has(n.path));
      if (missing.length === 0) {
        // Drop-only branch — only update state if the previous map had
        // entries that no longer exist.
        if (next.size !== previous.size && !cancelled) setContentCache(next);
        return;
      }

      const limit = readLimitRef.current;
      await Promise.all(
        missing.map((n) =>
          limit(async () => {
            try {
              const c = await fs.readFile(n.path);
              if (!cancelled) next.set(n.path, c);
            } catch {
              /* skip unreadable */
            }
          }),
        ),
      );
      if (!cancelled) setContentCache(next);
    })();
    return () => { cancelled = true; };
  }, [state.tree, state.vaultPath]);

  // ── Pane drag handles ─────────────────────────────
  const draggingRef = useRef<"sidebar" | "noteList" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const jumpToLineRef = useRef<((line: number) => void) | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (draggingRef.current === "sidebar") {
      setSidebarWidth(clamp(x, SIDEBAR_MIN, SIDEBAR_MAX));
    } else {
      setNoteListWidth(clamp(x - sidebarWidth - 4, NOTELIST_MIN, NOTELIST_MAX));
    }
  }, [sidebarWidth]);

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const startDrag = (which: "sidebar" | "noteList") => (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = which;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // ── FS operations ─────────────────────────────────
  const refreshTree = useCallback(async () => {
    if (!state.vaultPath) return;
    try {
      const fs = await getFS();
      const tree = await fs.readDirRecursive(state.vaultPath);
      dispatch({ type: "SET_TREE", tree });
    } catch (e) {
      console.error("Failed to refresh tree:", e);
    }
  }, [state.vaultPath, dispatch]);

  const loadNotesForFolder = useCallback(
    async (folderPath: string) => {
      const fs = await getFS();
      const fileEntries =
        folderPath === state.vaultPath
          ? collectAllNotes(state.tree)
          : collectNotesInFolder(state.tree, folderPath);

      const notes: Note[] = await Promise.all(
        fileEntries.map(async (entry) => {
          let excerpt = "";
          try {
            const cached = contentCache.get(entry.path);
            const content = cached ?? (await fs.readFile(entry.path));
            excerpt = buildExcerpt(content);
          } catch { /* ignore */ }
          return {
            name: entry.name,
            title: entry.name.replace(/\.md$/, ""),
            path: entry.path,
            excerpt,
            modifiedAt: entry.modifiedAt,
            createdAt: entry.createdAt,
            size: entry.size,
          };
        }),
      );

      dispatch({ type: "SELECT_FOLDER", path: folderPath, notes });
    },
    [state.vaultPath, state.tree, dispatch, contentCache],
  );

  const handleSelectFolder = useCallback(
    (path: string) => {
      setActiveTagFilter(null);
      void loadNotesForFolder(path);
    },
    [loadNotesForFolder],
  );

  // Reload notes when tree changes.
  useEffect(() => {
    if (state.selectedFolder) void loadNotesForFolder(state.selectedFolder);
    else if (state.vaultPath) void loadNotesForFolder(state.vaultPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tree]);

  // External-change detection: only trigger when the *cache* changes
  // for the active note AND the new value did NOT originate from our
  // own save call. We track our last local write per-path so any
  // mismatch can be confidently attributed to an external editor.
  const lastLocalWriteRef = useRef<Map<string, string>>(new Map());
  const prevCacheValueRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!state.activeNotePath) {
      if (externalChange) setExternalChange(null);
      return;
    }
    const path = state.activeNotePath;
    const cached = contentCache.get(path);
    if (cached === undefined) return;
    const prevCached = prevCacheValueRef.current.get(path);
    prevCacheValueRef.current.set(path, cached);
    if (prevCached === undefined) return; // First time we've seen the cache for this note.
    if (prevCached === cached) return;     // No real change.
    // Cache changed: was it from us? If our last local write equals the
    // new cache value, this is our own save round-tripping.
    if (lastLocalWriteRef.current.get(path) === cached) return;
    // External writer wins.
    setExternalChange({ content: cached });
  }, [contentCache, state.activeNotePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tracks the most-recent vault we restored for, so we don't keep
  // re-opening the last note every time the tree refreshes.
  const lastNoteRestoredRef = useRef<string | null>(null);

  /** Open a markdown note OR a canvas file. Records the visit in
   *  the per-vault navigation history (drives ⌘[ / ⌘] back/forward). */
  const handleSelectNote = useCallback(
    async (path: string) => {
      try {
        const fs = await getFS();
        const content = await fs.readFile(path);
        if (path.endsWith(".canvas")) {
          // Open as canvas.
          setActiveCanvasPath(path);
          setActiveCanvasContent(content);
          if (state.vaultPath) pushVisit(state.vaultPath, path);
          return;
        }
        // Switch off canvas if it was open.
        setActiveCanvasPath(null);
        setActiveCanvasContent("");
        setPreviewVersion(null);
        setExternalChange(null);
        // Reading the file gives us the canonical content — record it
        // as our baseline so future cache updates can be compared.
        prevCacheValueRef.current.set(path, content);
        lastLocalWriteRef.current.set(path, content);
        dispatch({ type: "OPEN_NOTE", path, content });
        if (state.vaultPath) pushVisit(state.vaultPath, path);
      } catch (e) {
        console.error("Failed to open note:", e);
        dispatch({
          type: "SET_ERROR",
          error: e instanceof Error ? e.message : "Failed to open note",
        });
      }
    },
    [dispatch, state.vaultPath],
  );

  /** Open a note WITHOUT recording it in the navigation history.
   *  Used by ⌘[ / ⌘] so back/forward don't pollute the stack. */
  const openNoteSilently = useCallback(
    async (path: string) => {
      try {
        const fs = await getFS();
        const content = await fs.readFile(path);
        if (path.endsWith(".canvas")) {
          setActiveCanvasPath(path);
          setActiveCanvasContent(content);
          return;
        }
        setActiveCanvasPath(null);
        setActiveCanvasContent("");
        setPreviewVersion(null);
        setExternalChange(null);
        prevCacheValueRef.current.set(path, content);
        lastLocalWriteRef.current.set(path, content);
        dispatch({ type: "OPEN_NOTE", path, content });
      } catch (e) {
        console.error("Failed to open note:", e);
      }
    },
    [dispatch],
  );

  const goBack = useCallback(() => {
    if (!state.vaultPath) return;
    const target = navigateBack(state.vaultPath);
    if (target) void openNoteSilently(target);
  }, [state.vaultPath, openNoteSilently]);

  const goForward = useCallback(() => {
    if (!state.vaultPath) return;
    const target = navigateForward(state.vaultPath);
    if (target) void openNoteSilently(target);
  }, [state.vaultPath, openNoteSilently]);

  // Restore the last-opened note exactly once per vault open. Runs only
  // when the tree has finished loading so file existence checks work.
  useEffect(() => {
    if (!state.vaultPath || state.tree.length === 0) return;
    if (state.activeNotePath) return;
    if (lastNoteRestoredRef.current === state.vaultPath) return;
    lastNoteRestoredRef.current = state.vaultPath;
    const last = getLastNote(state.vaultPath);
    if (!last) return;
    // Only restore if the note still exists in the current tree.
    const stillExists = collectAllNotes(state.tree).some((n) => n.path === last)
      || collectAllCanvases(state.tree).some((n) => n.path === last);
    if (stillExists) void openNoteSilently(last);
  }, [state.vaultPath, state.tree, state.activeNotePath, openNoteSilently]);

  /**
   * Save the active markdown note. Serialised per-path via a keyed
   * mutex so two saves to the same note can never interleave —
   * eliminating the "older write wins" race when typing fast.
   * A version snapshot of the *prior* content is taken before the
   * write so history reflects every distinct edit.
   */
  const handleSave = useCallback(
    async (content: string) => {
      if (!state.activeNotePath) return;
      const path = state.activeNotePath;
      const lock = saveLockRef.current;
      try {
        await lock(path, async () => {
          // Snapshot the previous content into history.
          const prev = cacheRef.current.get(path);
          if (prev !== undefined && prev !== content) {
            try { await pushVersion(path, prev); } catch { /* ignore */ }
          }
          const fs = await getFS();
          await fs.writeFile(path, content);
          // Mark this write as our own *before* the cache update lands
          // so the external-change detector can distinguish it.
          lastLocalWriteRef.current.set(path, content);
          // Update cache so graph / palette / backlinks reflect changes.
          setContentCache((m) => {
            const next = new Map(m);
            next.set(path, content);
            return next;
          });
        });
        setHistoryRefreshKey((k) => k + 1);
      } catch (e) {
        console.error("Failed to save:", e);
        dispatch({
          type: "SET_ERROR",
          error: e instanceof Error ? e.message : "Failed to save note",
        });
      }
    },
    [state.activeNotePath, dispatch],
  );

  /** Save a canvas file (called by CanvasView via auto-save). */
  const handleCanvasSave = useCallback(
    async (json: string) => {
      if (!activeCanvasPath) return;
      try {
        const fs = await getFS();
        await fs.writeFile(activeCanvasPath, json);
        setActiveCanvasContent(json);
      } catch (e) {
        console.error("Failed to save canvas:", e);
      }
    },
    [activeCanvasPath],
  );

  const handleWikiLinkClick = useCallback(
    async (linkName: string) => {
      const note = findNoteByTitle(state.tree, linkName);
      if (note) {
        await handleSelectNote(note.path);
        return;
      }
      // Auto-create the note in the active folder.
      if (!state.vaultPath) return;
      try {
        const fs = await getFS();
        const folder = state.selectedFolder ?? state.vaultPath;
        const newPath = `${folder}/${linkName}.md`;
        await fs.writeFile(newPath, `# ${linkName}\n\n`);
        await refreshTree();
        await handleSelectNote(newPath);
      } catch (e) {
        console.error("Failed to create wiki-link note:", e);
      }
    },
    [state.tree, state.selectedFolder, state.vaultPath, handleSelectNote, refreshTree],
  );

  /** Toggle the active tag filter. */
  const handleTagClick = useCallback(
    (tag: string) => {
      setActiveTagFilter(tag);
      const matching: Note[] = [];
      for (const note of collectAllNotes(state.tree)) {
        const content = contentCache.get(note.path) ?? "";
        if (noteHasTag(content, tag)) {
          matching.push({
            name: note.name,
            title: note.name.replace(/\.md$/, ""),
            path: note.path,
            excerpt: buildExcerpt(content),
            modifiedAt: note.modifiedAt,
            createdAt: note.createdAt,
            size: note.size,
          });
        }
      }
      dispatch({ type: "SELECT_FOLDER", path: state.vaultPath ?? "", notes: matching });
    },
    [state.tree, state.vaultPath, contentCache, dispatch],
  );

  const handleClearTagFilter = useCallback(() => {
    setActiveTagFilter(null);
    if (state.vaultPath) void loadNotesForFolder(state.selectedFolder ?? state.vaultPath);
  }, [state.vaultPath, state.selectedFolder, loadNotesForFolder]);

  /** Quick light/dark theme toggle, used by the palette. */
  const toggleTheme = useCallback(() => {
    const isLight = settings.theme === "trevor-light" || settings.theme === "solarized-light";
    setSetting("theme", isLight ? "trevor-dark" : "trevor-light");
  }, [settings.theme, setSetting]);

  /** Open or create today's daily note. */
  const handleOpenDailyNote = useCallback(async () => {
    if (!state.vaultPath) return;
    const fs = await getFS();
    const today = new Date();
    const stamp = today.toISOString().slice(0, 10);
    const dailyFolder = `${state.vaultPath}/Daily`;
    const path = `${dailyFolder}/${stamp}.md`;
    if (!(await fs.exists(dailyFolder))) {
      try { await fs.createDir(dailyFolder); } catch { /* exists */ }
    }
    if (!(await fs.exists(path))) {
      const body = `# ${today.toLocaleDateString(undefined, {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })}\n\n## Notes\n\n- \n\n## Tasks\n\n- [ ] \n\n## Reflections\n\n`;
      await fs.writeFile(path, body);
      await refreshTree();
    }
    await handleSelectNote(path);
  }, [state.vaultPath, refreshTree, handleSelectNote]);

  /** Open or create today's canvas. */
  const handleOpenCanvas = useCallback(async () => {
    if (!state.vaultPath) return;
    const fs = await getFS();
    const folder = `${state.vaultPath}/Canvas`;
    if (!(await fs.exists(folder))) {
      try { await fs.createDir(folder); } catch { /* exists */ }
    }
    // Create / open a fresh "Untitled Canvas" each time, suffixed if collision.
    let name = "Untitled Canvas.canvas";
    let i = 1;
    while (await fs.exists(`${folder}/${name}`)) {
      name = `Untitled Canvas (${++i}).canvas`;
    }
    const path = `${folder}/${name}`;
    await fs.writeFile(path, JSON.stringify({ nodes: [], edges: [] }, null, 2));
    await refreshTree();
    await handleSelectNote(path);
  }, [state.vaultPath, refreshTree, handleSelectNote]);

  /** Switch to a different vault. */
  const handleSwitchVault = useCallback((path: string) => {
    const opener = (window as unknown as { __trevor_openVault?: (p: string) => Promise<void> }).__trevor_openVault;
    if (opener) void opener(path);
  }, []);

  const handleOpenNewVault = useCallback(() => {
    const show = (window as unknown as { __trevor_showPicker?: () => void }).__trevor_showPicker;
    if (show) show();
  }, []);

  /**
   * Create a new note. Folder selection precedence:
   *   1. settings.defaultNoteFolder (relative to vault) if set,
   *   2. otherwise the currently selected folder,
   *   3. otherwise the vault root.
   * The default folder is auto-created if it doesn't exist yet.
   */
  const handleCreateNote = useCallback(async () => {
    if (!state.vaultPath) return;
    const fs = await getFS();
    let folder = state.selectedFolder ?? state.vaultPath;
    const defFolder = settings.defaultNoteFolder.trim();
    if (defFolder) {
      const target = `${state.vaultPath}/${defFolder.replace(/^\/+|\/+$/g, "")}`;
      try {
        if (!(await fs.exists(target))) await fs.createDir(target);
        folder = target;
      } catch (e) {
        console.warn("Default note folder unusable, falling back:", e);
      }
    }
    const ts = new Date();
    const stamp = ts.toISOString().slice(0, 10);
    let name = `Untitled ${stamp}.md`;
    let i = 1;
    while (await fs.exists(`${folder}/${name}`)) {
      name = `Untitled ${stamp} (${++i}).md`;
    }
    const path = `${folder}/${name}`;
    let body = settings.newNoteTemplate;
    if (body) {
      body = body
        .replace(/\{\{date\}\}/g, ts.toLocaleDateString())
        .replace(/\{\{time\}\}/g, ts.toLocaleTimeString())
        .replace(/\{\{title\}\}/g, name.replace(/\.md$/, ""));
    } else {
      body = `# ${name.replace(/\.md$/, "")}\n\n`;
    }
    await fs.writeFile(path, body);
    await refreshTree();
    await handleSelectNote(path);
  }, [state.vaultPath, state.selectedFolder, settings.newNoteTemplate, settings.defaultNoteFolder, refreshTree, handleSelectNote]);

  // ── History interactions ─────────────────────────
  const handleRestoreVersion = useCallback(
    async (v: NoteVersion) => {
      if (!state.activeNotePath) return;
      // Snapshot current first.
      try {
        if (state.activeNoteContent) {
          await pushVersion(state.activeNotePath, state.activeNoteContent);
        }
      } catch { /* ignore */ }
      dispatch({ type: "UPDATE_NOTE_CONTENT", content: v.content });
      await handleSave(v.content);
      setPreviewVersion(null);
    },
    [state.activeNotePath, state.activeNoteContent, dispatch, handleSave],
  );

  // ── Bulk note operations (multi-select in NoteList) ──
  const handleBulkMove = useCallback(
    async (paths: string[], targetFolder: string) => {
      if (!state.vaultPath || paths.length === 0) return;
      const fs = await getFS();
      let activeRemap: { from: string; to: string } | null = null;

      for (const p of paths) {
        const parent = p.slice(0, p.lastIndexOf("/"));
        if (parent === targetFolder) continue;
        if (targetFolder.startsWith(p + "/")) continue;
        try {
          const newPath = await fs.moveItem(p, targetFolder);
          if (state.vaultPath) {
            renamePinned(state.vaultPath, p, newPath);
            renameInHistory(state.vaultPath, p, newPath);
          }
          if (p.endsWith(".md")) {
            try { await renameVersionPath(p, newPath); } catch { /* ignore */ }
          }
          // Update content cache key.
          setContentCache((m) => {
            if (!m.has(p)) return m;
            const next = new Map(m);
            next.set(newPath, m.get(p)!);
            next.delete(p);
            return next;
          });
          if (state.activeNotePath === p) activeRemap = { from: p, to: newPath };
        } catch (e) {
          console.error("Bulk move failed for", p, e);
        }
      }

      if (activeRemap) {
        dispatch({ type: "UPDATE_NOTE_PATH", oldPath: activeRemap.from, newPath: activeRemap.to });
      }
      // The tree change will retrigger loadNotesForFolder via the
      // useEffect([state.tree]) below — no need to also call it here.
      await refreshTree();
    },
    [state.vaultPath, state.activeNotePath, renamePinned, dispatch, refreshTree],
  );

  const handleBulkDelete = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      const fs = await getFS();
      for (const p of paths) {
        try {
          await fs.remove(p);
          if (state.vaultPath) {
            removePinned(state.vaultPath, p);
            purgeFromHistory(state.vaultPath, p);
          }
          if (p.endsWith(".md")) {
            try { await clearVersionsForPath(p); } catch { /* ignore */ }
          }
          setContentCache((m) => {
            if (!m.has(p)) return m;
            const next = new Map(m);
            next.delete(p);
            return next;
          });
          if (state.activeNotePath === p) {
            dispatch({ type: "CLOSE_NOTE" });
          }
        } catch (e) {
          console.error("Bulk delete failed for", p, e);
        }
      }
      await refreshTree();
    },
    [state.vaultPath, state.activeNotePath, removePinned, dispatch, refreshTree],
  );

  // ── Export handlers ──────────────────────────────
  const handleExportHtml = useCallback(() => {
    if (!state.activeNotePath) return;
    const title = noteTitle(state.activeNotePath);
    const html = renderMarkdown(state.activeNoteContent);
    exportNoteAsHtml(title, html);
  }, [state.activeNotePath, state.activeNoteContent]);

  const handleExportMarkdown = useCallback(() => {
    if (!state.activeNotePath) return;
    const title = noteTitle(state.activeNotePath);
    exportNoteAsMarkdown(title, state.activeNoteContent);
  }, [state.activeNotePath, state.activeNoteContent]);

  const handleExportVault = useCallback(() => {
    const entries = Array.from(contentCache.entries()).map(([path, content]) => ({ path, content }));
    if (entries.length === 0) {
      alert("No notes to export yet.");
      return;
    }
    exportVaultAsBundle(entries);
  }, [contentCache]);

  /**
   * Print the active note as PDF using the platform print pipeline.
   * Renders to a fresh, light-themed page so PDFs are readable; embeds
   * print-friendly typography, page-breaks, and the same external-link
   * arrow used in the in-app preview.
   */
  const handleExportPdf = useCallback(() => {
    if (!state.activeNotePath) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const title = noteTitle(state.activeNotePath);
    const html = renderMarkdown(state.activeNoteContent);
    const safeTitle = title.replace(/[<>&"]/g, (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c),
    );
    const accent = settings.accentColor;
    printWindow.document.write(`<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
@page { margin: 18mm 16mm; }
:root { --accent: ${accent}; --text: #1a1a1a; --muted:#525258; --border:#e3e4e8; --surface:#f6f6f8; }
* { box-sizing: border-box; }
body { font-family:-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif;
  max-width: 760px; margin: 0 auto; padding: 28px 28px 40px;
  color: var(--text); line-height: 1.7; font-size: 14.5px; }
h1.doc-title { font-size: 28px; font-weight: 700; line-height: 1.25;
  border-bottom: 2px solid var(--accent); padding-bottom: 10px; margin: 0 0 22px; }
h1, h2, h3, h4, h5, h6 { page-break-after: avoid; color: var(--text); }
h2 { font-size: 22px; border-bottom: 1px solid var(--border); padding-bottom: 4px; margin-top: 28px; }
h3 { font-size: 17.5px; margin-top: 22px; }
h4 { font-size: 15px; }
p, li { orphans: 3; widows: 3; }
a { color: var(--accent); text-decoration: none; border-bottom: 1px solid rgba(0,0,0,0.06); }
a.external-link { white-space: nowrap; }
a.external-link .external-link-icon { display:inline-block; vertical-align:baseline; margin-left:2px; transform: translateY(1px); opacity:.85; }
code { background: var(--surface); padding: 1px 5px; border-radius: 3px; font-size: 0.86em;
  font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; }
pre { background: var(--surface); border:1px solid var(--border); padding: 12px 14px;
  border-radius: 6px; overflow-x: auto; break-inside: avoid; page-break-inside: avoid; }
pre code { background: none; padding: 0; font-size: 12.5px; line-height: 1.55; }
blockquote { border-left: 3px solid var(--accent); padding: 4px 14px; color: var(--muted);
  margin: 14px 0; background: rgba(0,0,0,0.025); border-radius: 0 4px 4px 0; }
table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13.5px; }
th, td { border: 1px solid var(--border); padding: 7px 10px; text-align: left; }
th { background: var(--surface); font-weight: 600; }
img { max-width: 100%; height: auto; }
hr { border: none; border-top: 1px solid var(--border); margin: 22px 0; }
.callout { border-left: 3px solid var(--accent); padding: 8px 12px; margin: 12px 0;
  background: rgba(0,0,0,0.025); border-radius: 0 4px 4px 0; }
.tag-pill { display:inline-block; padding: 1px 8px; font-size: 0.82em; border-radius: 999px;
  border: 1px solid var(--border); }
.tag-pill-declared { background: rgba(0,0,0,0.04); color: var(--accent); border-color: var(--accent); }
.wiki-link { color: var(--accent); font-weight: 500; }
.declared-tag-bar { display:flex; flex-wrap:wrap; gap:6px; margin: 0 0 16px;
  padding-bottom: 8px; border-bottom: 1px dashed var(--border); }
mark { background: rgba(255, 235, 80, 0.55); padding: 0 2px; border-radius: 2px; }
@media print { body { padding: 0; max-width: none; } a { color: var(--accent); } }
</style>
</head><body>
<h1 class="doc-title">${safeTitle}</h1>
${html}
</body></html>`);
    printWindow.document.close();
    // Give the printer some breathing room to load fonts before triggering.
    setTimeout(() => printWindow.print(), 450);
  }, [state.activeNotePath, state.activeNoteContent, settings.accentColor]);

  /**
   * Import a previously-exported Trevor vault bundle.  Prompts the user
   * to pick a `.md` bundle file (Tauri native dialog when available),
   * parses it, then writes each note into a date-stamped Imported
   * folder inside the current vault.
   */
  const handleImportVault = useCallback(async () => {
    if (!state.vaultPath) {
      alert("Open a vault before importing.");
      return;
    }
    const fs = await getFS();

    // 1) Read the bundle text — Tauri uses native open dialog, browser uses <input type="file">.
    let bundleText: string | null = null;
    try {
      if ((await import("@/lib/platform")).isTauri()) {
        const dlg = await import("@tauri-apps/plugin-dialog");
        const fsApi = await import("@tauri-apps/plugin-fs");
        const path = await dlg.open({
          multiple: false,
          filters: [{ name: "Trevor bundle / Markdown", extensions: ["md", "markdown", "txt"] }],
        });
        if (typeof path !== "string") return;
        bundleText = await fsApi.readTextFile(path);
      } else {
        bundleText = await pickFileInBrowser();
        if (bundleText == null) return;
      }
    } catch (e) {
      console.error("Import: failed to read bundle:", e);
      alert("Couldn't read that file. Make sure it's a Trevor bundle.");
      return;
    }

    if (!bundleText) return;
    const entries = parseVaultBundle(bundleText);
    if (entries.length === 0) {
      alert("No notes detected in this file. Is it a Trevor bundle?");
      return;
    }

    // 2) Create destination folder.
    const stamp = new Date().toISOString().slice(0, 10);
    let folder = `${state.vaultPath}/Imported ${stamp}`;
    let n = 1;
    while (await fs.exists(folder)) folder = `${state.vaultPath}/Imported ${stamp} (${++n})`;
    await fs.createDir(folder);

    // 3) Write each note, skipping name collisions.
    let written = 0;
    for (const entry of entries) {
      let name = entry.path.replace(/[\\/:*?"<>|]/g, "_");
      if (!name.endsWith(".md")) name += ".md";
      let target = `${folder}/${name}`;
      let i = 1;
      while (await fs.exists(target)) {
        const base = name.replace(/\.md$/, "");
        target = `${folder}/${base} (${++i}).md`;
      }
      try {
        await fs.writeFile(target, entry.content);
        written += 1;
      } catch (e) {
        console.error("Import: failed to write", target, e);
      }
    }

    await refreshTree();
    alert(`Imported ${written} note${written === 1 ? "" : "s"} into "${folder.split("/").pop()}".`);
  }, [state.vaultPath, refreshTree]);

  // ── Global hotkeys ────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const inEditor = !!target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );

      if (meta && e.key.toLowerCase() === "k" && !e.shiftKey) {
        if (inEditor) return; // Editor's own ⌘K → insert link
        e.preventDefault();
        setShowPalette(true);
      }
      if (meta && e.key === ",") {
        e.preventDefault();
        setShowSettings(true);
      }
      if (meta && e.key === "/" && !e.shiftKey) {
        e.preventDefault();
        setShowHelp(true);
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setShowGraph((v) => !v);
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void handleOpenCanvas();
      }
      if (meta && e.key.toLowerCase() === "n" && !e.shiftKey) {
        e.preventDefault();
        void handleCreateNote();
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        void handleOpenDailyNote();
      }
      if (meta && e.key === ".") {
        e.preventDefault();
        setShowRightPanel((v) => !v);
      }
      if (meta && e.key.toLowerCase() === "p" && !e.shiftKey) {
        if (inEditor) return; // don't hijack typing 'p'
        e.preventDefault();
        setShowPomodoro((v) => !v);
      }
      // Back / forward navigation through recently-opened notes.
      // ⌘[ goes back, ⌘] forward — never hijack while typing.
      if (meta && e.key === "[" && !inEditor) {
        e.preventDefault();
        goBack();
      }
      if (meta && e.key === "]" && !inEditor) {
        e.preventDefault();
        goForward();
      }
      if (e.key === "Escape") {
        if (showPalette) setShowPalette(false);
        else if (showSettings) setShowSettings(false);
        else if (showGraph) setShowGraph(false);
        else if (showTagManager) setShowTagManager(false);
        else if (showHelp) setShowHelp(false);
        else if (activeCanvasPath) setActiveCanvasPath(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    handleCreateNote, handleOpenDailyNote, handleOpenCanvas,
    goBack, goForward,
    showPalette, showSettings, showGraph, showTagManager, showHelp, activeCanvasPath,
  ]);

  // ── Derived data for palette + graph ──────────────
  const allNotes: TreeNode[] = useMemo(() => {
    if (!state.tree.length) return [];
    return [
      ...collectAllNotes(state.tree).map(toTreeNode),
      ...collectAllCanvases(state.tree).map(toTreeNode),
    ];
  }, [state.tree]);

  const allTags = useMemo(() => collectAllTags(contentCache), [contentCache]);

  /** Vault-wide tag index (declared + inline) for the Tag Manager autocomplete. */
  const vaultTagNames = useMemo(
    () => buildTagIndex(contentCache).map((s) => s.tag),
    [contentCache],
  );

  /** Mutate the active note's content (used by TagManager). */
  const handleUpdateActiveContent = useCallback(
    (next: string) => {
      dispatch({ type: "UPDATE_NOTE_CONTENT", content: next });
      void handleSave(next);
    },
    [dispatch, handleSave],
  );

  // Debounce the cache identity that drives heavy graph rebuilds. While
  // the user types, autosave updates the cache rapidly; rebuilding the
  // entire graph each time wastes cycles. We only freshen `cacheForGraph`
  // 300ms after the cache stops changing.
  const [cacheForGraph, setCacheForGraph] = useState(contentCache);
  useEffect(() => {
    const id = setTimeout(() => setCacheForGraph(contentCache), 300);
    return () => clearTimeout(id);
  }, [contentCache]);

  const graphData = useMemo(() => {
    if (!state.tree.length) return { nodes: [], links: [] };
    if (!showGraph) return { nodes: [], links: [] }; // skip cost while closed
    const root: TreeNode = {
      name: "vault",
      path: state.vaultPath ?? "/",
      kind: "folder",
      children: state.tree.map(toTreeNode),
    };
    return buildGraph(root, cacheForGraph);
  }, [state.tree, state.vaultPath, cacheForGraph, showGraph]);

  // Vault notes for the Canvas note-embed picker.
  const vaultNotesForCanvas = useMemo(
    () => collectAllNotes(state.tree).map((n) => ({
      path: n.path,
      title: n.name.replace(/\.md$/, ""),
    })),
    [state.tree],
  );

  const paletteCommands = useMemo(
    () =>
      buildDefaultCommands({
        onOpenSettings: () => setShowSettings(true),
        onToggleTheme: toggleTheme,
        onCreateNote: () => void handleCreateNote(),
        onOpenVault: handleOpenNewVault,
        onImportVault: () => void handleImportVault(),
        onExportVault: handleExportVault,
        onToggleToolbarPosition: () =>
          setSetting(
            "editorToolbarPosition",
            settings.editorToolbarPosition === "top" ? "bottom" : "top",
          ),
      }),
    [toggleTheme, handleCreateNote, handleOpenNewVault, handleImportVault, handleExportVault,
     setSetting, settings.editorToolbarPosition],
  );

  const hasActiveNote = !!state.activeNotePath;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-trevor-bg text-trevor-text">
      <TitleBar
        onOpenSettings={() => setShowSettings(true)}
        onOpenPalette={() => setShowPalette(true)}
        onOpenGraph={() => setShowGraph(true)}
        onOpenDaily={() => void handleOpenDailyNote()}
        onOpenCanvas={() => void handleOpenCanvas()}
        onOpenHelp={() => setShowHelp(true)}
        onTogglePomodoro={() => setShowPomodoro((v) => !v)}
        pomodoroOpen={showPomodoro}
        onTogglePanel={() => setShowRightPanel((v) => !v)}
        panelOpen={showRightPanel}
        onSwitchVault={handleSwitchVault}
        onOpenNewVault={handleOpenNewVault}
        onExportPdf={handleExportPdf}
        onExportHtml={handleExportHtml}
        onExportMarkdown={handleExportMarkdown}
        onExportVault={handleExportVault}
        onImportVault={() => void handleImportVault()}
        hasActiveNote={hasActiveNote}
      />

      {/* Tag filter banner */}
      {activeTagFilter && (
        <div className="px-4 py-1.5 bg-trevor-accent/10 border-b border-trevor-accent/30 text-[12px] text-trevor-accent flex items-center justify-between flex-shrink-0">
          <span>
            Filtering by tag <strong>#{activeTagFilter}</strong>
          </span>
          <button
            onClick={handleClearTagFilter}
            className="text-[11px] hover:underline"
          >
            Clear filter ✕
          </button>
        </div>
      )}

      <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-shrink-0 h-full overflow-hidden" style={{ width: sidebarWidth }}>
          <Sidebar
            onSelectFolder={handleSelectFolder}
            onSelectNote={handleSelectNote}
            onRefreshTree={refreshTree}
            onOpenSettings={() => setShowSettings(true)}
            onOpenGraph={() => setShowGraph(true)}
          />
        </div>
        <div
          onMouseDown={startDrag("sidebar")}
          className="app-resize-handle w-[4px] cursor-col-resize flex-shrink-0"
          title="Drag to resize sidebar"
        />
        <div className="flex-shrink-0 h-full overflow-hidden" style={{ width: noteListWidth }}>
          <NoteList
            onSelectNote={handleSelectNote}
            onBulkMove={handleBulkMove}
            onBulkDelete={handleBulkDelete}
            onOpenMoveDialog={(paths) => setMoveTargets(paths)}
          />
        </div>
        <div
          onMouseDown={startDrag("noteList")}
          className="app-resize-handle w-[4px] cursor-col-resize flex-shrink-0"
          title="Drag to resize note list"
        />
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          <EditorPane
            onSave={handleSave}
            onWikiLinkClick={handleWikiLinkClick}
            onTagClick={handleTagClick}
            onOpenSettings={() => setShowSettings(true)}
            onOpenTagManager={() => setShowTagManager(true)}
            jumpToLineRef={jumpToLineRef}
            previewOverride={previewVersion?.content ?? null}
            onClearPreviewOverride={() => setPreviewVersion(null)}
            onExportPdf={handleExportPdf}
            externalChangeContent={externalChange?.content ?? null}
            onAcceptExternalChange={() => {
              if (!state.activeNotePath || !externalChange) return;
              const path = state.activeNotePath;
              const newContent = externalChange.content;
              dispatch({ type: "UPDATE_NOTE_CONTENT", content: newContent });
              prevCacheValueRef.current.set(path, newContent);
              lastLocalWriteRef.current.set(path, newContent);
              setExternalChange(null);
            }}
            onDismissExternalChange={() => setExternalChange(null)}
          />
        </div>

        {/* Right context panel */}
        {showRightPanel && (
          <RightPanel
            open={showRightPanel}
            onClose={() => setShowRightPanel(false)}
            activeNotePath={state.activeNotePath}
            activeNoteContent={state.activeNoteContent}
            contentCache={contentCache}
            historyRefreshKey={historyRefreshKey}
            onJumpToLine={(line) => jumpToLineRef.current?.(line)}
            onOpenNote={(target) => {
              if (target.endsWith(".md") || target.endsWith(".canvas")) {
                void handleSelectNote(target);
              } else {
                void handleWikiLinkClick(target);
              }
            }}
            onRestoreVersion={(v) => void handleRestoreVersion(v)}
            onPreviewVersion={setPreviewVersion}
          />
        )}
      </div>

      {/* Canvas overlay (Phase 5) */}
      {activeCanvasPath && (
        <CanvasView
          fileKey={activeCanvasPath}
          initialContent={activeCanvasContent}
          vaultNotes={vaultNotesForCanvas}
          onSave={(json) => void handleCanvasSave(json)}
          onOpenNote={(p) => {
            setActiveCanvasPath(null);
            void handleSelectNote(p);
          }}
          onClose={() => setActiveCanvasPath(null)}
        />
      )}

      {/* Pomodoro widget */}
      <PomodoroTimer open={showPomodoro} onClose={() => setShowPomodoro(false)} />

      {/* Help dialog */}
      <ShortcutsHelp open={showHelp} onClose={() => setShowHelp(false)} />

      {/* Settings */}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}

      {/* Command palette — also performs full-text search via contentCache. */}
      <CommandPalette
        open={showPalette}
        onClose={() => setShowPalette(false)}
        notes={allNotes}
        tags={allTags}
        commands={paletteCommands}
        contentCache={contentCache}
        onOpenNote={(path, line) => {
          void (async () => {
            await handleSelectNote(path);
            if (typeof line === "number") {
              // Wait one frame for the editor to mount the textarea/preview,
              // then jump.  jumpToLineRef is wired by EditorPane.
              requestAnimationFrame(() => jumpToLineRef.current?.(line));
            }
          })();
        }}
        onSelectTag={handleTagClick}
      />

      {/* Graph view */}
      {showGraph && (
        <GraphView
          nodes={graphData.nodes}
          links={graphData.links}
          onNodeClick={(id) => {
            void handleSelectNote(id);
            setShowGraph(false);
          }}
          onClose={() => setShowGraph(false)}
        />
      )}

      {/* Move-to-folder dialog */}
      <MoveToFolderDialog
        open={moveTargets !== null}
        vaultPath={state.vaultPath}
        tree={state.tree}
        sourcePaths={moveTargets ?? []}
        onClose={() => setMoveTargets(null)}
        onPick={async (folder) => {
          const targets = moveTargets ?? [];
          setMoveTargets(null);
          await handleBulkMove(targets, folder);
        }}
      />

      {/* Tag manager */}
      {state.activeNotePath && (
        <TagManager
          open={showTagManager}
          onClose={() => setShowTagManager(false)}
          content={state.activeNoteContent}
          onChange={handleUpdateActiveContent}
          vaultTags={vaultTagNames}
        />
      )}
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Browser-only fallback file picker.  Resolves with the file's text
 * content, or null if the user cancels.  Used when running outside
 * Tauri (e.g. during dev preview).
 */
function pickFileInBrowser(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt,text/markdown,text/plain";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) {
        resolve(null);
        return;
      }
      try {
        const text = await f.text();
        resolve(text);
      } catch {
        resolve(null);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
