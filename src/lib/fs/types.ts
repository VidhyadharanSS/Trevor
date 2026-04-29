/**
 * Trevor File System Types (Phase 2)
 *
 * Unified types for the file system abstraction layer.
 * Both Tauri and Browser (mock) implementations conform to this interface.
 */

export interface FileEntry {
  /** File or folder name (e.g., "my-note.md") */
  name: string;
  /** Full path (e.g., "/Users/me/vault/my-note.md") */
  path: string;
  /** Whether this entry is a directory */
  isDirectory: boolean;
  /** File size in bytes (0 for directories) */
  size: number;
  /** Last modification timestamp (epoch ms) */
  modifiedAt: number;
  /** Created timestamp (epoch ms) */
  createdAt: number;
  /** Children entries (populated for directories when reading recursively) */
  children?: FileEntry[];
}

/**
 * Lightweight tree-walk representation used by graph / palette helpers.
 * Distinct from `FileEntry` because we sometimes synthesise virtual
 * roots (e.g. "vault") that don't correspond to a real file entry.
 */
export interface TreeNode {
  name: string;
  path: string;
  kind: "file" | "folder";
  children?: TreeNode[];
}

/** A note (an .md file) */
export interface Note {
  name: string;
  /** Display title (filename without .md) */
  title: string;
  path: string;
  /** First ~200 chars of content */
  excerpt: string;
  modifiedAt: number;
  createdAt: number;
  size: number;
}

/** Notebook = a folder inside the vault */
export interface Notebook {
  name: string;
  path: string;
  children: Notebook[];
  noteCount: number;
}

/** File system change event (emitted by Rust watcher or mock) */
export interface FSChangeEvent {
  kind: "create" | "modify" | "remove";
  paths: string[];
}

/**
 * Unified File System API.
 * Both Tauri (native) and MockFS (browser) implementations conform to this.
 */
export interface FileSystemAPI {
  // ── Directory Operations ─────────────────────────
  readDir(path: string): Promise<FileEntry[]>;
  readDirRecursive(path: string): Promise<FileEntry[]>;
  createDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;

  // ── File Operations ──────────────────────────────
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  /** Move a file/folder into a target directory, returns new path */
  moveItem(sourcePath: string, targetDir: string): Promise<string>;

  // ── Vault Operations ─────────────────────────────
  pickFolder(): Promise<string | null>;

  // ── Watching ─────────────────────────────────────
  startWatching?(rootPath: string): Promise<void>;
  stopWatching?(): Promise<void>;
  onChange?(callback: (event: FSChangeEvent) => void): () => void;
}

// ── Path Helpers ──────────────────────────────────

/** Helper: extract parent path from a full file path */
export function parentPath(filePath: string): string {
  const parts = filePath.split("/");
  parts.pop();
  return parts.join("/") || "/";
}

/** Helper: join path segments */
export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p : p.replace(/^\//, "")))
    .join("/")
    .replace(/\/+/g, "/");
}

/** Helper: get filename from path */
export function fileName(filePath: string): string {
  return filePath.split("/").pop() ?? "";
}

/** Helper: get title from .md filename */
export function noteTitle(filePath: string): string {
  return fileName(filePath).replace(/\.md$/, "");
}

/** Helper: build excerpt from markdown content */
export function buildExcerpt(content: string, maxLen = 160): string {
  if (!content) return "";
  // Strip markdown syntax for cleaner excerpt
  const stripped = content
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + "…" : stripped;
}

/** Convert FileEntry to Note (only for .md files) */
export function fileEntryToNote(entry: FileEntry, content?: string): Note {
  return {
    name: entry.name,
    title: entry.name.replace(/\.md$/, ""),
    path: entry.path,
    excerpt: content ? buildExcerpt(content) : "",
    modifiedAt: entry.modifiedAt,
    createdAt: entry.createdAt,
    size: entry.size,
  };
}
