//! Per-user desktop state under `~/.openbase/boilersync-desktop`: the project
//! list (`repos.json`, or the shared Openbase `coder-projects.json` when that
//! exists) and app settings (`settings.json`). File formats are shared with
//! the Electron app so existing installs keep their projects and settings.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

fn openbase_dir() -> PathBuf {
    home_dir().join(".openbase")
}

fn app_dir() -> PathBuf {
    openbase_dir().join("boilersync-desktop")
}

/// The project list file: the Openbase Coder project list when present,
/// otherwise this app's own `repos.json`.
pub fn default_config_path() -> PathBuf {
    let shared = openbase_dir().join("coder-projects.json");
    if shared.exists() {
        shared
    } else {
        app_dir().join("repos.json")
    }
}

fn settings_file() -> PathBuf {
    app_dir().join("settings.json")
}

/// The project list path in use. Settable at runtime (not persisted), as in
/// the Electron app.
pub struct ConfigPathState(Mutex<PathBuf>);

impl Default for ConfigPathState {
    fn default() -> Self {
        Self(Mutex::new(default_config_path()))
    }
}

impl ConfigPathState {
    pub fn path(&self) -> PathBuf {
        self.0
            .lock()
            .map(|p| p.clone())
            .unwrap_or_else(|e| e.into_inner().clone())
    }

    fn set(&self, path: PathBuf) {
        if let Ok(mut guard) = self.0.lock() {
            *guard = path;
        }
    }
}

/// Configured project paths, in file order. Missing or unreadable → empty.
pub fn read_project_paths(config_path: &Path) -> Vec<String> {
    let Ok(text) = std::fs::read_to_string(config_path) else {
        return Vec::new();
    };
    let Ok(Value::Array(entries)) = serde_json::from_str::<Value>(&text) else {
        return Vec::new();
    };
    entries
        .iter()
        .filter_map(|entry| entry.get("path").and_then(Value::as_str))
        .map(str::to_string)
        .collect()
}

fn write_json(path: &Path, value: &impl Serialize) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
    }
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    std::fs::write(path, text).map_err(|e| format!("{}: {e}", path.display()))
}

fn write_project_paths(config_path: &Path, paths: &[String]) -> Result<(), String> {
    let entries: Vec<Value> = paths.iter().map(|p| json!({ "path": p })).collect();
    write_json(config_path, &Value::Array(entries))
}

pub fn add_project(config_path: &Path, path: &str) -> Result<(), String> {
    let mut paths = read_project_paths(config_path);
    if paths.iter().any(|p| p == path) {
        return Ok(());
    }
    paths.push(path.to_string());
    write_project_paths(config_path, &paths)
}

pub fn remove_project(config_path: &Path, path: &str) -> Result<(), String> {
    if !config_path.exists() {
        return Ok(());
    }
    let paths: Vec<String> = read_project_paths(config_path)
        .into_iter()
        .filter(|p| p != path)
        .collect();
    write_project_paths(config_path, &paths)
}

/// Editor used to open a freshly generated project.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ProjectOpenProgram {
    #[default]
    Cursor,
    Vscode,
}

impl ProjectOpenProgram {
    pub fn from_setting(value: &str) -> Self {
        match value {
            "vscode" => ProjectOpenProgram::Vscode,
            _ => ProjectOpenProgram::Cursor,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            ProjectOpenProgram::Cursor => "cursor",
            ProjectOpenProgram::Vscode => "vscode",
        }
    }

    /// Command candidates for this editor, tried in order.
    pub fn commands(self) -> &'static [&'static str] {
        match self {
            ProjectOpenProgram::Cursor => &["cursor"],
            ProjectOpenProgram::Vscode => &["code", "vscode"],
        }
    }

    pub fn fallback(self) -> Self {
        match self {
            ProjectOpenProgram::Cursor => ProjectOpenProgram::Vscode,
            ProjectOpenProgram::Vscode => ProjectOpenProgram::Cursor,
        }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "openAIApiKey"
    )]
    pub open_ai_api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_open_program: Option<String>,
}

pub fn read_settings() -> AppSettings {
    std::fs::read_to_string(settings_file())
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub fn write_settings(settings: &AppSettings) -> Result<(), String> {
    write_json(&settings_file(), settings)
}

pub fn project_open_program_setting() -> ProjectOpenProgram {
    ProjectOpenProgram::from_setting(
        read_settings()
            .project_open_program
            .as_deref()
            .unwrap_or_default(),
    )
}

#[tauri::command]
pub fn get_config_path(state: tauri::State<'_, ConfigPathState>) -> String {
    state.path().display().to_string()
}

#[tauri::command]
pub fn set_config_path(state: tauri::State<'_, ConfigPathState>, new_path: String) {
    state.set(PathBuf::from(new_path));
}

#[tauri::command]
pub fn add_repo(state: tauri::State<'_, ConfigPathState>, repo_path: String) -> Result<(), String> {
    add_project(&state.path(), &repo_path)
}

#[tauri::command]
pub fn remove_repo(
    state: tauri::State<'_, ConfigPathState>,
    repo_path: String,
) -> Result<(), String> {
    remove_project(&state.path(), &repo_path)
}

#[tauri::command]
pub fn get_open_ai_api_key() -> String {
    read_settings().open_ai_api_key.unwrap_or_default()
}

#[tauri::command]
pub fn set_open_ai_api_key(api_key: String) -> Result<(), String> {
    let mut settings = read_settings();
    settings.open_ai_api_key = Some(api_key.trim().to_string());
    write_settings(&settings)
}

#[tauri::command]
pub fn get_project_open_program() -> String {
    project_open_program_setting().as_str().to_string()
}

#[tauri::command]
pub fn set_project_open_program(program: String) -> Result<(), String> {
    let mut settings = read_settings();
    settings.project_open_program = Some(
        ProjectOpenProgram::from_setting(&program)
            .as_str()
            .to_string(),
    );
    write_settings(&settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_list_round_trips_and_deduplicates() {
        let tmp = tempfile::tempdir().unwrap();
        let config = tmp.path().join("nested").join("repos.json");
        add_project(&config, "/a").unwrap();
        add_project(&config, "/b").unwrap();
        add_project(&config, "/a").unwrap();
        assert_eq!(read_project_paths(&config), ["/a", "/b"]);
        remove_project(&config, "/a").unwrap();
        assert_eq!(read_project_paths(&config), ["/b"]);
        assert!(read_project_paths(&tmp.path().join("missing.json")).is_empty());
    }

    #[test]
    fn open_program_normalizes_unknown_values() {
        assert_eq!(
            ProjectOpenProgram::from_setting("vscode"),
            ProjectOpenProgram::Vscode
        );
        assert_eq!(
            ProjectOpenProgram::from_setting("emacs"),
            ProjectOpenProgram::Cursor
        );
        assert_eq!(
            ProjectOpenProgram::Vscode.fallback(),
            ProjectOpenProgram::Cursor
        );
        let settings: AppSettings =
            serde_json::from_str(r#"{"openAIApiKey": "k", "projectOpenProgram": "vscode"}"#)
                .unwrap();
        assert_eq!(settings.project_open_program.as_deref(), Some("vscode"));
        assert_eq!(settings.open_ai_api_key.as_deref(), Some("k"));
    }
}
