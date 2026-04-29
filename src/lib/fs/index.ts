/**
 * Trevor — File System Abstraction Layer
 *
 * This module provides a unified file system API that works in both:
 *   1. Tauri (native) — real file system via Tauri plugins
 *   2. Browser (dev)  — in-memory mock FS with sample data
 *
 * Usage:
 *   import { getFS } from "@/lib/fs";
 *   const fs = await getFS();
 *   const entries = await fs.readDir("/path/to/vault");
 */

import type { FileSystemAPI } from "./types";
import { isTauri } from "../platform";

let _fs: FileSystemAPI | null = null;

/**
 * Get the file system singleton.
 * Lazily instantiates the correct implementation.
 */
export async function getFS(): Promise<FileSystemAPI> {
  if (_fs) return _fs;

  if (isTauri()) {
    const { TauriFS } = await import("./tauri-fs");
    _fs = new TauriFS();
  } else {
    const { MockFS } = await import("./mock-fs");
    _fs = new MockFS();
    console.info(
      "%c[Trevor] Running in browser mode with mock file system",
      "color: #6366f1; font-weight: bold;"
    );
  }

  return _fs;
}

// Re-export types and helpers
export type { FileSystemAPI, FileEntry, Notebook, Note, FSChangeEvent } from "./types";
export {
  parentPath,
  joinPath,
  fileName,
  noteTitle,
  buildExcerpt,
  fileEntryToNote,
} from "./types";
