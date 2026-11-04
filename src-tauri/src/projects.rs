//! Project inspection commands over [`crate::inspect`]: the configured project
//! list, fresh statuses, project detail and history group diffs.

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::inspect::{self, HistoryCommitRef, HistoryRepoDiff, ProjectDetail, ProjectSummary};
use crate::store::read_project_paths;
use crate::tasks::blocking;

/// Configured projects, served from the summary cache while fresh data is
/// computed in the background.
#[tauri::command]
pub async fn get_projects_summary(
    state: tauri::State<'_, crate::store::ConfigPathState>,
) -> Result<Vec<ProjectSummary>, String> {
    let config_path = state.path();
    blocking(move || inspect::get_projects_summary(&read_project_paths(&config_path))).await
}

/// Freshly computed summaries (the UI merges them by path).
#[tauri::command]
pub async fn get_project_statuses(repo_paths: Vec<String>) -> Result<Vec<ProjectSummary>, String> {
    blocking(move || inspect::refresh_projects_summary(&repo_paths)).await
}

/// Diffs, combined history and sync state for one project and its children.
#[tauri::command]
pub async fn get_project_detail(repo_path: String) -> Result<ProjectDetail, String> {
    if repo_path.is_empty() {
        return Err("repoPath must be a non-empty string.".into());
    }
    blocking(move || inspect::get_project_detail(&PathBuf::from(&repo_path))).await
}

/// Per-repo diffs for the commits of one history group.
#[tauri::command]
pub async fn get_history_group_diff(
    commits: Vec<HistoryCommitRef>,
) -> Result<Vec<HistoryRepoDiff>, String> {
    blocking(move || inspect::get_history_group_diff(&commits)).await
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationTarget {
    pub repo_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

/// Resolve a filesystem path (from `boilersync://open?path=...` or a drop) to
/// the repository containing it. Files resolve to their git top level.
pub fn resolve_navigation_target(input: &Path) -> Option<NavigationTarget> {
    inspect::resolve_navigation_path(input).map(|(repo_path, file_path)| NavigationTarget {
        repo_path: repo_path.display().to_string(),
        file_path,
    })
}
