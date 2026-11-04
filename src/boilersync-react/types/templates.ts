export interface TemplateSource {
  org: string;
  repo: string;
  path: string;
  remote_url: string | null;
  branch: string | null;
  commit: string | null;
  template_count: number;
}

export interface TemplateListEntry {
  template_ref: string;
  org: string;
  repo: string;
  subdir: string;
  template_dir: string;
  display_name: string;
}

export interface TemplateInputField {
  name: string;
  label?: string;
  description?: string;
  type?: string;
  required?: boolean;
  default?: unknown;
  choices?: unknown[];
  cli_flag?: string;
  [key: string]: unknown;
}

export interface TemplateDetails {
  template_ref: string;
  template_dir: string;
  template_root_dir?: string;
  inheritance_chain?: string[];
  project_fields?: TemplateInputField[];
  variables?: TemplateInputField[];
  options?: TemplateInputField[];
  [key: string]: unknown;
}

export type FieldValues = Record<string, unknown>;
