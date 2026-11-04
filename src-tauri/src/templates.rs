//! Template commands over `boilersync-core`: list the cached templates, show a
//! template's inputs and scaffold a project, then open it in the editor.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use boilersync_core::commands::init::{InitOptions, init};
use boilersync_core::commands::templates::{
    LocalTemplate, TemplateDetails, get_template_details as core_details, list_local_templates,
};
use boilersync_core::jinja::Context;
use boilersync_core::paths::Paths;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::store::{ProjectOpenProgram, project_open_program_setting};
use crate::tasks::blocking;

const EDITOR_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, Serialize)]
pub struct TemplateListPayload {
    pub template_root_dir: String,
    pub count: usize,
    pub templates: Vec<LocalTemplate>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateGenerateRequest {
    pub template_ref: String,
    pub target_dir: String,
    #[serde(default)]
    pub project_name: Option<String>,
    #[serde(default)]
    pub pretty_name: Option<String>,
    #[serde(default)]
    pub variables: Option<Context>,
    #[serde(default)]
    pub options: Option<Context>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateGenerateResult {
    pub target_dir: String,
    pub opened_with: String,
    pub used_fallback: bool,
}

fn paths_at(cwd: &Path) -> Result<Paths, String> {
    Ok(Paths::from_env()
        .map_err(|e| e.to_string())?
        .at(cwd.to_path_buf()))
}

#[tauri::command]
pub async fn list_templates() -> Result<TemplateListPayload, String> {
    blocking(|| {
        let paths = paths_at(&std::env::temp_dir())?;
        let templates = list_local_templates(&paths).map_err(|e| e.to_string())?;
        Ok(TemplateListPayload {
            template_root_dir: paths.template_root_dir().display().to_string(),
            count: templates.len(),
            templates,
        })
    })
    .await?
}

#[tauri::command]
pub async fn get_template_details(template_ref: String) -> Result<TemplateDetails, String> {
    blocking(move || {
        let paths = paths_at(&std::env::temp_dir())?;
        core_details(&paths, &template_ref).map_err(|e| e.to_string())
    })
    .await?
}

/// Try the preferred editor's commands, then the other editor's.
fn open_project_in_editor(
    target_dir: &Path,
    preferred: ProjectOpenProgram,
) -> Result<(String, bool), String> {
    for (program, used_fallback) in [(preferred, false), (preferred.fallback(), true)] {
        for command in program.commands() {
            let launched = Command::new(command)
                .arg(target_dir)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
            let Ok(mut child) = launched else { continue };
            let started = std::time::Instant::now();
            loop {
                match child.try_wait() {
                    Ok(Some(status)) if status.success() => {
                        return Ok((command.to_string(), used_fallback));
                    }
                    Ok(Some(_)) => break,
                    Ok(None) if started.elapsed() >= EDITOR_TIMEOUT => {
                        // Still running: the editor took the directory and stayed in the foreground.
                        return Ok((command.to_string(), used_fallback));
                    }
                    Ok(None) => std::thread::sleep(Duration::from_millis(50)),
                    Err(_) => break,
                }
            }
        }
    }
    Err("Could not open project in Cursor or VS Code.".to_string())
}

fn non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}

fn prepare_target_dir(target_dir: &str) -> Result<PathBuf, String> {
    let trimmed = target_dir.trim();
    if trimmed.is_empty() {
        return Err("Target directory is required.".to_string());
    }
    let target = boilersync_core::fsx::expanduser(trimmed);
    let target = if target.is_absolute() {
        target
    } else {
        std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(target)
    };
    if target.exists() {
        if !target.is_dir() {
            return Err("Target path exists and is not a directory.".to_string());
        }
        if std::fs::read_dir(&target)
            .map_err(|e| e.to_string())?
            .next()
            .is_some()
        {
            return Err("Target directory must be empty.".to_string());
        }
    } else {
        std::fs::create_dir_all(&target).map_err(|e| format!("{}: {e}", target.display()))?;
    }
    Ok(boilersync_core::fsx::resolve(&target))
}

/// Scaffold a project from a template without prompts, then open it in the
/// configured editor.
#[tauri::command]
pub async fn generate_template_project(
    request: TemplateGenerateRequest,
) -> Result<TemplateGenerateResult, String> {
    blocking(move || {
        let template_ref = request.template_ref.trim().to_string();
        if template_ref.is_empty() {
            return Err("Template ref is required.".to_string());
        }
        let target_dir = prepare_target_dir(&request.target_dir)?;

        let mut variables = request.variables.unwrap_or_default();
        if let Some(name) = non_empty(request.project_name.as_deref()) {
            variables.insert("name_snake".to_string(), Value::String(name));
        }
        if let Some(pretty) = non_empty(request.pretty_name.as_deref()) {
            variables.insert("name_pretty".to_string(), Value::String(pretty));
        }
        let options = InitOptions {
            template_variables: if variables.is_empty() {
                None
            } else {
                Some(variables)
            },
            options: request.options.filter(|map| !map.is_empty()),
            no_input: true,
            ..InitOptions::new()
        };
        let paths = paths_at(&target_dir)?;
        init(&paths, &template_ref, &target_dir, &options).map_err(|e| e.to_string())?;

        let (opened_with, used_fallback) =
            open_project_in_editor(&target_dir, project_open_program_setting())?;
        Ok(TemplateGenerateResult {
            target_dir: target_dir.display().to_string(),
            opened_with,
            used_fallback,
        })
    })
    .await?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_dir_must_be_empty_or_new() {
        let tmp = tempfile::tempdir().unwrap();
        let fresh = tmp.path().join("new-project");
        assert!(
            prepare_target_dir(fresh.to_str().unwrap())
                .unwrap()
                .ends_with("new-project")
        );
        assert!(fresh.is_dir());
        std::fs::write(fresh.join("file"), "x").unwrap();
        assert_eq!(
            prepare_target_dir(fresh.to_str().unwrap()).unwrap_err(),
            "Target directory must be empty."
        );
        assert_eq!(
            prepare_target_dir(fresh.join("file").to_str().unwrap()).unwrap_err(),
            "Target path exists and is not a directory."
        );
        assert_eq!(
            prepare_target_dir("  ").unwrap_err(),
            "Target directory is required."
        );
    }

    #[test]
    fn requests_accept_the_electron_shape() {
        let request: TemplateGenerateRequest = serde_json::from_str(
            r#"{"templateRef": "acme/t#x", "targetDir": "/tmp/x", "projectName": "demo", "variables": {"a": 1}, "options": {}}"#,
        )
        .unwrap();
        assert_eq!(request.project_name.as_deref(), Some("demo"));
        assert_eq!(request.variables.unwrap()["a"], 1);
        assert!(request.pretty_name.is_none());
    }
}
