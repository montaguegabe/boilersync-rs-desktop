/**
 * Payload types shared with the Rust side (`inspect.rs`, serialized in
 * camelCase). Kept compatible with the Electron app's contract.
 */
import type { HistoryGroup, Repository } from 'multi-react';

export interface NavigateToRepoPayload {
  repoPath: string;
  filePath?: string;
}

export type RepoStatus = 'clean' | 'dirty' | 'out-of-sync' | 'no_git' | 'missing' | 'unknown';

export interface RepoSyncState {
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  isRepo: boolean;
}

export interface SubRepo {
  name: string;
  path: string;
}

export interface ProjectSummary {
  path: string;
  name?: string;
  status: RepoStatus;
  lastModifiedMs?: number | null;
  lastCommitMs?: number | null;
  /** Child projects registered in the project's `.boilersync`. */
  subRepos?: SubRepo[] | null;
}

export interface ProjectDetail {
  repoPath: string;
  repositories: Repository[];
  historyGroups: HistoryGroup[];
  syncStatesByRepoPath: Record<string, RepoSyncState>;
  subRepos: SubRepo[] | null;
}

export type ProjectOpenProgram = 'cursor' | 'vscode';

export interface TemplateGenerateRequest {
  templateRef: string;
  targetDir: string;
  projectName?: string;
  prettyName?: string;
  variables?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface TemplateGenerateResult {
  targetDir: string;
  openedWith: string;
  usedFallback: boolean;
}
