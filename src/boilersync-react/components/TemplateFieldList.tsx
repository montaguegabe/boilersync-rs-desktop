import type { FieldValues, TemplateInputField } from "../types/templates";
import { cn } from "multi-react";
import {
  getTemplateFieldLabel,
  getTemplateFieldType,
} from "../utils/templateFields";
import { TemplateInput } from "./TemplateInput";

export interface TemplateFieldListProps {
  title?: string;
  fields: TemplateInputField[];
  values?: FieldValues;
  onFieldChange?: (name: string, value: unknown) => void;
  inputIdPrefix?: string;
  emptyText?: string;
  compact?: boolean;
  className?: string;
}

export function TemplateFieldList({
  title,
  fields,
  values = {},
  onFieldChange,
  inputIdPrefix = "template-field",
  emptyText = "None",
  compact = false,
  className,
}: TemplateFieldListProps) {
  const interactive = Boolean(onFieldChange);

  return (
    <section className={cn(compact ? "space-y-1.5" : "space-y-3", className)}>
      {title ? (
        <h2
          className={
            compact
              ? "text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              : "text-base font-semibold"
          }
        >
          {title}
        </h2>
      ) : null}

      {fields.length === 0 ? (
        <div
          className={cn(
            "rounded border border-dashed border-border text-muted-foreground",
            compact ? "px-2 py-2 text-[12px]" : "px-3 py-3 text-sm",
          )}
        >
          {emptyText}
        </div>
      ) : interactive ? (
        <div className={compact ? "space-y-2" : "space-y-3"}>
          {fields.map((field) => (
            <TemplateFieldEditor
              key={field.name}
              field={field}
              inputId={`${inputIdPrefix}-${field.name}`}
              value={values[field.name]}
              onChange={(nextValue) => onFieldChange?.(field.name, nextValue)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-border">
          {fields.map((field, index) => (
            <TemplateFieldSummary
              key={field.name}
              field={field}
              className={index > 0 ? "border-t border-border" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TemplateFieldEditor({
  field,
  inputId,
  value,
  onChange,
}: {
  field: TemplateInputField;
  inputId: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const isInlineBoolean =
    getTemplateFieldType(field) === "boolean" && !field.choices?.length;

  return (
    <div className="space-y-1">
      {!isInlineBoolean ? (
        <label htmlFor={inputId} className="block text-sm font-medium">
          {getTemplateFieldLabel(field)}
          {field.required ? " *" : ""}
        </label>
      ) : null}
      <TemplateInput
        field={field}
        inputId={inputId}
        value={value}
        onChange={onChange}
      />
      {(field.description || field.name) && (
        <p className="text-xs text-muted-foreground">
          {field.description || field.name}
        </p>
      )}
    </div>
  );
}

function TemplateFieldSummary({
  field,
  className,
}: {
  field: TemplateInputField;
  className?: string;
}) {
  const choices = Array.isArray(field.choices) ? field.choices : [];
  const metadata = [
    getTemplateFieldType(field),
    field.required ? "required" : "optional",
    field.cli_flag,
  ].filter(Boolean);

  return (
    <div className={cn("px-2 py-1.5", className)}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate font-mono text-[11.5px] text-foreground">
          {field.name}
        </span>
        <span className="ml-auto shrink-0 text-[10.5px] text-muted-foreground">
          {metadata.join(" · ")}
        </span>
      </div>
      {field.label && field.label !== field.name ? (
        <p className="mt-0.5 truncate text-[11px] text-foreground">
          {field.label}
        </p>
      ) : null}
      {field.description ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
          {field.description}
        </p>
      ) : null}
      {field.default !== undefined || choices.length > 0 ? (
        <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
          {field.default !== undefined
            ? `default: ${String(field.default)}`
            : ""}
          {field.default !== undefined && choices.length > 0 ? " · " : ""}
          {choices.length > 0
            ? `choices: ${choices.map(String).join(", ")}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
