// ─────────────────────────────────────────────────────────────────
// Trevor — Tauri entry (Phase 2)
// ─────────────────────────────────────────────────────────────────

mod commands;

use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage::<commands::WatcherState>(Mutex::new(None))
        .invoke_handler(tauri::generate_handler![
            commands::fs_read_dir,
            commands::fs_read_dir_recursive,
            commands::fs_create_dir,
            commands::fs_exists,
            commands::fs_read_file,
            commands::fs_write_file,
            commands::fs_remove,
            commands::fs_rename,
            commands::fs_move,
            commands::fs_start_watching,
            commands::fs_stop_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Trevor application");
}
