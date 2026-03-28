#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;

/// Mount a local directory as a virtual filesystem workspace.
/// In production this will map paths from the NEXUS VFS naming conventions
/// to actual OS directories, enabling DCC tools to read/write directly.
#[tauri::command]
fn vfs_mount(project_id: &str, mount_point: &str) -> Result<String, String> {
    // Placeholder: real implementation will create symlinks / FUSE mounts
    Ok(format!(
        "VFS mounted: project={} at {}",
        project_id, mount_point
    ))
}

/// Launch a DCC application (Maya, Houdini, Nuke, etc.) with the given file.
/// Falls back to the OS default application for the file type.
#[tauri::command]
fn launch_dcc(file_path: &str) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", file_path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(format!("Launched: {}", file_path))
}

/// Check the sync status of local files against the remote server.
/// Returns a JSON-serialisable summary.
#[tauri::command]
fn file_sync_status(project_id: &str) -> Result<String, String> {
    // Placeholder: real implementation will compare local hashes with server
    Ok(format!(
        r#"{{"project_id":"{}","status":"synced","pending_uploads":0,"pending_downloads":0}}"#,
        project_id
    ))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            vfs_mount,
            launch_dcc,
            file_sync_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NEXUS Desktop");
}
