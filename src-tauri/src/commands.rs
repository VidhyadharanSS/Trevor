// ─────────────────────────────────────────────────────────────────
// Trevor — File System Commands (Phase 2)
// All commands are exposed to the React frontend via Tauri's IPC.
// ─────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use notify::{RecursiveMode, Watcher};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use tauri::{AppHandle, Emitter, State};

// ── Types ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified_at: u64,
    pub created_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileEntry>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultChangeEvent {
    pub kind: String,
    pub paths: Vec<String>,
}

// ── State ────────────────────────────────────────────────────────

pub type WatcherState = Mutex<Option<Debouncer<notify::RecommendedWatcher>>>;

// ── Helpers ──────────────────────────────────────────────────────

fn to_epoch_ms(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn entry_from_path(path: &Path) -> Result<FileEntry, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(FileEntry {
        name,
        path: path.to_string_lossy().to_string(),
        is_directory: metadata.is_dir(),
        size: if metadata.is_file() {
            metadata.len()
        } else {
            0
        },
        modified_at: metadata.modified().map(to_epoch_ms).unwrap_or(0),
        created_at: metadata.created().map(to_epoch_ms).unwrap_or(0),
        children: None,
    })
}

fn should_skip(name: &str) -> bool {
    // Skip hidden files, .git, node_modules, .DS_Store, etc.
    name.starts_with('.') || name == "node_modules" || name == "Thumbs.db"
}

// ── Directory Operations ─────────────────────────────────────────

#[tauri::command]
pub fn fs_read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let mut entries = Vec::new();
    let read = fs::read_dir(p).map_err(|e| e.to_string())?;
    for entry in read.flatten() {
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip(&name) {
            continue;
        }
        if let Ok(fe) = entry_from_path(&entry_path) {
            entries.push(fe);
        }
    }

    // Sort: directories first, then alphabetical
    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
pub fn fs_read_dir_recursive(path: String) -> Result<Vec<FileEntry>, String> {
    fn recurse(p: &Path) -> Result<Vec<FileEntry>, String> {
        let mut result = Vec::new();
        let read = fs::read_dir(p).map_err(|e| e.to_string())?;
        for entry in read.flatten() {
            let entry_path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if should_skip(&name) {
                continue;
            }
            let mut fe = match entry_from_path(&entry_path) {
                Ok(fe) => fe,
                Err(_) => continue,
            };
            if fe.is_directory {
                fe.children = Some(recurse(&entry_path).unwrap_or_default());
            }
            result.push(fe);
        }
        result.sort_by(|a, b| match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });
        Ok(result)
    }
    recurse(Path::new(&path))
}

#[tauri::command]
pub fn fs_create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

// ── File Operations ──────────────────────────────────────────────

#[tauri::command]
pub fn fs_read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_write_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_remove(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    let np = Path::new(&new_path);
    if let Some(parent) = np.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_move(source_path: String, target_dir: String) -> Result<String, String> {
    let src = Path::new(&source_path);
    if !src.exists() {
        return Err(format!("Source does not exist: {}", source_path));
    }
    let target = Path::new(&target_dir);
    if !target.exists() {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
    }
    let name = src
        .file_name()
        .ok_or_else(|| "Invalid source path".to_string())?;
    let new_path = target.join(name);
    if new_path.exists() {
        return Err(format!(
            "Target already exists: {}",
            new_path.to_string_lossy()
        ));
    }
    fs::rename(src, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

// ── Watching ─────────────────────────────────────────────────────

#[tauri::command]
pub fn fs_start_watching(
    app: AppHandle,
    state: State<'_, WatcherState>,
    path: String,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    // Stop previous watcher
    *guard = None;

    let app_handle = app.clone();
    let mut debouncer = new_debouncer(
        std::time::Duration::from_millis(300),
        move |res: DebounceEventResult| {
            if let Ok(events) = res {
                let paths: Vec<String> = events
                    .iter()
                    .map(|e| e.path.to_string_lossy().to_string())
                    .collect();
                if !paths.is_empty() {
                    let _ = app_handle.emit(
                        "vault://change",
                        VaultChangeEvent {
                            kind: "modify".into(),
                            paths,
                        },
                    );
                }
            }
        },
    )
    .map_err(|e| e.to_string())?;

    debouncer
        .watcher()
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    *guard = Some(debouncer);
    Ok(())
}

#[tauri::command]
pub fn fs_stop_watching(state: State<'_, WatcherState>) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}

// Helper for `lib.rs` to avoid unused-imports warnings
#[allow(dead_code)]
pub fn _ensure_pathbuf(p: &str) -> PathBuf {
    PathBuf::from(p)
}
