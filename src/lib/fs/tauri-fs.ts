/**
 * Trevor — Tauri File System Implementation (Phase 2)
 *
 * Native file system access via Tauri commands.
 * All commands are implemented in src-tauri/src/commands.rs
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { FileSystemAPI, FileEntry, FSChangeEvent } from "./types";

export class TauriFS implements FileSystemAPI {
  // ── Directory Operations ─────────────────────────

  async readDir(path: string): Promise<FileEntry[]> {
    return await invoke<FileEntry[]>("fs_read_dir", { path });
  }

  async readDirRecursive(path: string): Promise<FileEntry[]> {
    return await invoke<FileEntry[]>("fs_read_dir_recursive", { path });
  }

  async createDir(path: string): Promise<void> {
    await invoke("fs_create_dir", { path });
  }

  async exists(path: string): Promise<boolean> {
    return await invoke<boolean>("fs_exists", { path });
  }

  // ── File Operations ──────────────────────────────

  async readFile(path: string): Promise<string> {
    return await invoke<string>("fs_read_file", { path });
  }

  async writeFile(path: string, content: string): Promise<void> {
    await invoke("fs_write_file", { path, content });
  }

  async remove(path: string): Promise<void> {
    await invoke("fs_remove", { path });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await invoke("fs_rename", { oldPath, newPath });
  }

  async moveItem(sourcePath: string, targetDir: string): Promise<string> {
    return await invoke<string>("fs_move", { sourcePath, targetDir });
  }

  // ── Vault Operations ─────────────────────────────

  async pickFolder(): Promise<string | null> {
    const result = await open({
      directory: true,
      multiple: false,
      title: "Select your Trevor Vault folder",
    });
    return typeof result === "string" ? result : null;
  }

  // ── Watching ─────────────────────────────────────

  async startWatching(rootPath: string): Promise<void> {
    await invoke("fs_start_watching", { path: rootPath });
  }

  async stopWatching(): Promise<void> {
    await invoke("fs_stop_watching");
  }

  onChange(callback: (event: FSChangeEvent) => void): () => void {
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;

    listen<FSChangeEvent>("vault://change", (event) => {
      callback(event.payload);
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }
}
