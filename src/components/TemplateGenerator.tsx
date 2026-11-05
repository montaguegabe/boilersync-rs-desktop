import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderOpen, FolderGit2, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { FieldValues, TemplateDetails, TemplateListEntry } from 'boilersync-react';
import {
  TemplateFieldList,
  buildInitialFieldValues,
  getMissingRequiredTemplateFields,
  serializeTemplateFieldValues,
} from 'boilersync-react';
import { errorMessage, repoService } from '../lib/bridge';
import { PROJECTS_ROUTE, SETTINGS_ROUTE } from '../lib/routes';

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary';

export default function TemplateGenerator() {
  const navigate = useNavigate();
  const [templateRootDir, setTemplateRootDir] = useState('');
  const [templates, setTemplates] = useState<TemplateListEntry[]>([]);
  const [selectedTemplateRef, setSelectedTemplateRef] = useState('');
  const [details, setDetails] = useState<TemplateDetails | null>(null);
  const [targetDir, setTargetDir] = useState('');
  const [projectName, setProjectName] = useState('');
  const [prettyName, setPrettyName] = useState('');
  const [variableValues, setVariableValues] = useState<FieldValues>({});
  const [optionValues, setOptionValues] = useState<FieldValues>({});
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.template_ref === selectedTemplateRef) ?? null,
    [templates, selectedTemplateRef],
  );

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setError(null);
    try {
      const response = await repoService.listTemplates();
      setTemplateRootDir(response.template_root_dir);
      setTemplates(response.templates);
      setSelectedTemplateRef((previous) => {
        if (previous && response.templates.some((item) => item.template_ref === previous)) {
          return previous;
        }
        return response.templates[0]?.template_ref ?? '';
      });
    } catch (e: unknown) {
      setError(errorMessage(e));
      setTemplates([]);
      setSelectedTemplateRef('');
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    let active = true;

    if (!selectedTemplateRef) {
      setDetails(null);
      setVariableValues({});
      setOptionValues({});
      return () => {
        active = false;
      };
    }

    const loadDetails = async () => {
      setLoadingDetails(true);
      setError(null);
      try {
        const nextDetails = await repoService.getTemplateDetails(selectedTemplateRef);
        if (!active) return;
        setDetails(nextDetails);
        setVariableValues(buildInitialFieldValues(nextDetails.variables ?? []));
        setOptionValues(buildInitialFieldValues(nextDetails.options ?? []));
      } catch (e: unknown) {
        if (!active) return;
        setError(errorMessage(e));
        setDetails(null);
      } finally {
        if (active) setLoadingDetails(false);
      }
    };

    void loadDetails();

    return () => {
      active = false;
    };
  }, [selectedTemplateRef]);

  const updateVariable = useCallback((name: string, value: unknown) => {
    setVariableValues((current) => ({ ...current, [name]: value }));
  }, []);

  const updateOption = useCallback((name: string, value: unknown) => {
    setOptionValues((current) => ({ ...current, [name]: value }));
  }, []);

  const pickTargetDirectory = useCallback(async () => {
    const dir = await repoService.pickDirectory();
    if (dir) setTargetDir(dir);
  }, []);

  // name_snake and name_pretty have dedicated inputs above the variable list.
  const variableFields = useMemo(
    () => (details?.variables ?? []).filter((field) => field.name !== 'name_snake' && field.name !== 'name_pretty'),
    [details],
  );

  const generate = useCallback(async () => {
    if (!selectedTemplateRef) {
      setError('Select a template first.');
      return;
    }
    if (!targetDir.trim()) {
      setError('Target directory is required.');
      return;
    }
    if (details) {
      const missingVariable = getMissingRequiredTemplateFields(variableFields, variableValues)[0];
      if (missingVariable) {
        setError(`Required variable is missing: ${missingVariable.name}`);
        return;
      }
      const missingOption = getMissingRequiredTemplateFields(details.options ?? [], optionValues)[0];
      if (missingOption) {
        setError(`Required option is missing: ${missingOption.name}`);
        return;
      }
    }

    setGenerating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await repoService.generateTemplateProject({
        templateRef: selectedTemplateRef,
        targetDir: targetDir.trim(),
        projectName: projectName.trim() || undefined,
        prettyName: prettyName.trim() || undefined,
        variables: serializeTemplateFieldValues(variableFields, variableValues),
        options: serializeTemplateFieldValues(details?.options ?? [], optionValues),
      });
      const fallbackText = result.usedFallback ? ' (fallback used)' : '';
      setSuccessMessage(`Generated in ${result.targetDir} and opened with ${result.openedWith}${fallbackText}.`);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  }, [details, optionValues, prettyName, projectName, selectedTemplateRef, targetDir, variableFields, variableValues]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Scaffold Project</h1>
          <p className="text-xs text-muted-foreground">
            Choose a template, fill inputs, and generate with Boilersync
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(PROJECTS_ROUTE)}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            title="Projects"
          >
            <FolderGit2 className="h-4 w-4" />
          </button>
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
            onClick={() => void loadTemplates()}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            title="Refresh templates"
          >
            <RefreshCw className={`h-4 w-4 ${loadingTemplates ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="template-ref">
            Template
          </label>
          <select
            id="template-ref"
            className={INPUT_CLASS}
            value={selectedTemplateRef}
            onChange={(e) => setSelectedTemplateRef(e.target.value)}
            disabled={loadingTemplates || templates.length === 0}
          >
            {templates.length === 0 && <option value="">No templates found</option>}
            {templates.map((template) => (
              <option key={template.template_ref} value={template.template_ref}>
                {template.display_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Root: <code>{templateRootDir || '(not set)'}</code>
          </p>
          {selectedTemplate && (
            <p className="text-xs text-muted-foreground">
              Path: <code>{selectedTemplate.template_dir}</code>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="project-name">
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              className={INPUT_CLASS}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my_project (defaults to the target folder name)"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="pretty-name">
              Pretty Name
            </label>
            <input
              id="pretty-name"
              type="text"
              className={INPUT_CLASS}
              value={prettyName}
              onChange={(e) => setPrettyName(e.target.value)}
              placeholder="My Project"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="target-directory">
            Target Directory
          </label>
          <div className="flex items-center gap-2">
            <input
              id="target-directory"
              type="text"
              className={`flex-1 ${INPUT_CLASS}`}
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              placeholder="/absolute/path/to/empty-directory"
            />
            <button
              type="button"
              onClick={() => void pickTargetDirectory()}
              className="px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors inline-flex items-center gap-2"
            >
              <FolderOpen className="h-4 w-4" />
              Choose
            </button>
          </div>
        </div>

        {loadingDetails && <div className="text-sm text-muted-foreground">Loading template details...</div>}

        {!loadingDetails && details && (
          <div className="space-y-6">
            {variableFields.length > 0 && (
              <TemplateFieldList
                title="Variables"
                fields={variableFields}
                values={variableValues}
                onFieldChange={updateVariable}
                inputIdPrefix="var"
              />
            )}

            {(details.options ?? []).length > 0 && (
              <TemplateFieldList
                title="Options"
                fields={details.options ?? []}
                values={optionValues}
                onFieldChange={updateOption}
                inputIdPrefix="opt"
              />
            )}
          </div>
        )}

        {error && <div className="text-xs text-red-500 bg-red-500/10 rounded px-2 py-1">{error}</div>}

        {successMessage && (
          <div className="text-xs text-green-600 bg-green-500/10 rounded px-2 py-1">{successMessage}</div>
        )}

        <div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating || loadingTemplates || loadingDetails || !selectedTemplateRef}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? 'Generating...' : 'Generate Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
