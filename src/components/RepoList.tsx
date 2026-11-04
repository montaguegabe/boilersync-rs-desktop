import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { ArrowLeft, Plus, RefreshCw, Settings, X } from 'lucide-react';
import { errorMessage, repoService } from '../lib/bridge';
import { folderName } from '../lib/paths';
import { SCAFFOLD_ROUTE, SETTINGS_ROUTE, diffRoute } from '../lib/routes';
import type { ProjectSummary, RepoStatus } from '../lib/types';
import { getContextMenuActions } from './contextMenuActions';

const STATUS_CONFIG: Record<RepoStatus, { color: string; label: string; dot: string }> = {
  clean: { color: 'text-green-500', label: 'Clean', dot: 'bg-green-500' },
  dirty: { color: 'text-red-500', label: 'Uncommitted changes', dot: 'bg-red-500' },
  'out-of-sync': { color: 'text-yellow-500', label: 'Out of sync', dot: 'bg-yellow-500' },
  no_git: { color: 'text-muted-foreground', label: '', dot: 'bg-gray-400' },
  missing: { color: 'text-muted-foreground', label: 'Not found', dot: 'bg-gray-400' },
  unknown: { color: 'text-muted-foreground', label: 'Checking', dot: 'bg-gray-400' },
};

const POLL_INTERVAL_MS = 15_000;

function formatRelativeTime(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/** Replace entries by path with their refreshed versions, keeping file order. */
export function mergeProjectUpdates(current: ProjectSummary[], updates: ProjectSummary[]): ProjectSummary[] {
  const byPath = new Map(updates.map((update) => [update.path, update]));
  return current.map((project) => byPath.get(project.path) ?? project);
}

export default function RepoList() {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const repoContextActions = useMemo(() => getContextMenuActions(), []);

  const refreshProjectStatuses = useCallback(async (repoPaths: string[]) => {
    if (repoPaths.length === 0) return;
    try {
      const updates = await repoService.getProjectStatuses(repoPaths);
      setRepos((current) => mergeProjectUpdates(current, updates));
    } catch (err) {
      // The cached list stays on screen; the banner explains why it is stale.
      setError(errorMessage(err));
    }
  }, []);

  const fetchStatuses = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const summaries = await repoService.getProjectsSummary();
        setRepos(summaries);
        setError(null);
        void refreshProjectStatuses(summaries.map((summary) => summary.path));
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [refreshProjectStatuses],
  );

  useEffect(() => {
    void fetchStatuses();
    const interval = setInterval(() => void fetchStatuses(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  const addProjects = useCallback(
    async (paths: string[]) => {
      await Promise.all(paths.map((p) => repoService.addRepo(p)));
      await fetchStatuses();
    },
    [fetchStatuses],
  );

  // Tauri delivers filesystem drops through the webview, not HTML5 drag events.
  useEffect(() => {
    let disposed = false;
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (disposed) return;
      const { type } = event.payload;
      if (type === 'enter' || type === 'over') {
        setDragging(true);
      } else if (type === 'leave') {
        setDragging(false);
      } else if (type === 'drop') {
        setDragging(false);
        void addProjects(event.payload.paths);
      }
    });
    return () => {
      disposed = true;
      unlisten.then((fn) => fn());
    };
  }, [addProjects]);

  const handleRemove = async (e: MouseEvent, repoPath: string) => {
    e.stopPropagation();
    await repoService.removeRepo(repoPath);
    setRepos((prev) => prev.filter((r) => r.path !== repoPath));
  };

  const handleRepoContextMenu = useCallback(
    async (e: MouseEvent, repoPath: string) => {
      e.preventDefault();
      const selectedId = await repoService.showContextMenu(
        repoContextActions.map((action, index) => ({
          id: `repo-action-${index}`,
          label: action.label,
          type: 'normal' as const,
        })),
      );
      if (!selectedId?.startsWith('repo-action-')) return;
      const action = repoContextActions[Number(selectedId.slice('repo-action-'.length))];
      action?.onClick(repoPath);
    },
    [repoContextActions],
  );

  const handlePickDirectory = async () => {
    const dirPath = await repoService.pickDirectory();
    if (dirPath) {
      await addProjects([dirPath]);
    }
  };

  return (
    <div className={`flex flex-col h-full ${dragging ? 'ring-2 ring-primary ring-inset' : ''}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(SCAFFOLD_ROUTE)}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
            title="Scaffold a project"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">Projects</h1>
            <p className="text-xs text-muted-foreground">
              {repos.length} project{repos.length !== 1 ? 's' : ''} configured
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(SETTINGS_ROUTE)}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void handlePickDirectory()}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            title="Add project"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void fetchStatuses()}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-500 bg-red-500/10 rounded px-2 py-1 shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {repos.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <p className="text-sm">No repositories configured</p>
            <p className="text-xs">
              Add a project with the + button, drop a folder here, or edit{' '}
              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                ~/.openbase/boilersync-desktop/repos.json
              </code>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {repos.map((repo) => {
              const config = STATUS_CONFIG[repo.status];
              const displayName = repo.name || folderName(repo.path);
              const isClickable = repo.status !== 'missing' && repo.status !== 'no_git';
              const childCount = repo.subRepos?.length ?? 0;
              return (
                <div
                  key={repo.path}
                  className="group flex items-center gap-3 px-6 py-3 hover:bg-accent/50 transition-colors"
                  onContextMenu={(e) => void handleRepoContextMenu(e, repo.path)}
                >
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => navigate(diffRoute({ repoPath: repo.path, name: displayName }))}
                    className={`flex items-center gap-3 flex-1 min-w-0 text-left ${!isClickable ? 'opacity-50' : ''}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${config?.dot ?? 'bg-gray-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{repo.path}</p>
                    </div>
                    {childCount > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {childCount} child project{childCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {(repo.lastCommitMs || repo.lastModifiedMs) && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatRelativeTime(repo.lastCommitMs ?? repo.lastModifiedMs ?? 0)}
                      </span>
                    )}
                    {config?.label && (
                      <span className={`text-xs font-medium shrink-0 ${config.color}`}>{config.label}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => void handleRemove(e, repo.path)}
                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Remove project"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
