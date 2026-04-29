/**
 * Trevor — File System Watcher (Phase 2)
 *
 * Uses the `notify` crate to watch the vault directory for changes.
 * Emits Tauri events to the frontend when files are modified externally.
 */
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// Start watching a vault directory for file changes.
/// Emits "fs-change" events to the frontend.
pub fn start_watching(app_handle: AppHandle, vault_path: String) {
    thread::spawn(move || {
        let (tx, rx) = mpsc::channel();

        let mut watcher = match RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default().with_poll_interval(Duration::from_secs(2)),
        ) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[Trevor Watcher] Failed to create watcher: {}", e);
                return;
            }
        };

        let path = Path::new(&vault_path);
        if let Err(e) = watcher.watch(path, RecursiveMode::Recursive) {
            eprintln!("[Trevor Watcher] Failed to watch {}: {}", vault_path, e);
            return;
        }

        println!("[Trevor Watcher] Watching: {}", vault_path);

        // Process events with debouncing
        loop {
            match rx.recv_timeout(Duration::from_millis(500)) {
                Ok(event) => {
                    let kind = match event.kind {
                        EventKind::Create(_) => "create",
                        EventKind::Modify(_) => "modify",
                        EventKind::Remove(_) => "remove",
                        EventKind::Access(_) => continue, // Skip access events
                        _ => continue,
                    };

                    let paths: Vec<String> = event
                        .paths
                        .iter()
                        .map(|p| p.to_string_lossy().to_string())
                        .collect();

                    // Emit event to all windows
                    let payload = serde_json::json!({
                        "kind": kind,
                        "paths": paths,
                    });

                    if let Err(e) = app_handle.emit("fs-change", payload) {
                        eprintln!("[Trevor Watcher] Failed to emit event: {}", e);
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    // No events — continue watching
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    println!("[Trevor Watcher] Channel disconnected, stopping.");
                    break;
                }
            }
        }
    });
}

/// Tauri command: Start watching a vault path
#[tauri::command]
pub fn watch_vault(app_handle: AppHandle, path: String) -> Result<(), String> {
    start_watching(app_handle, path);
    Ok(())
}
