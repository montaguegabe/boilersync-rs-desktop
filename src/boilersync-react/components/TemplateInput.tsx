import type { TemplateInputField } from "../types/templates";
import { cn } from "multi-react";
import {
  getTemplateFieldLabel,
  getTemplateFieldType,
  normalizeTemplateFieldValue,
} from "../utils/templateFields";

export interface TemplateInputProps {
  field: TemplateInputField;
  inputId: string;
  value: unknown;
  onChange: (nextValue: unknown) => void;
  className?: string;
}

export function TemplateInput({
  field,
  inputId,
  value,
  onChange,
  className,
}: TemplateInputProps) {
  const type = getTemplateFieldType(field);
  const choices = Array.isArray(field.choices) ? field.choices : [];

  if (type === "boolean" && choices.length === 0) {
    return (
      <div className={cn("inline-flex items-center gap-2 text-sm", className)}>
        <input
          id={inputId}
          type="checkbox"
          className="rounded border-border"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <label htmlFor={inputId}>{getTemplateFieldLabel(field)}</label>
      </div>
    );
  }

  if (choices.length > 0) {
    return (
      <select
        id={inputId}
        className={cn(
          "w-full rounded-md border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary",
          className,
        )}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(event) =>
          onChange(normalizeTemplateFieldValue(field, event.target.value))
        }
      >
        {!field.required && <option value="">(none)</option>}
        {choices.map((choice) => {
          const valueAsString = String(choice);
          return (
            <option key={valueAsString} value={valueAsString}>
              {valueAsString}
            </option>
          );
        })}
      </select>
    );
  }

  const inputType =
    type === "number" ||
    type === "float" ||
    type === "integer" ||
    type === "int"
      ? "number"
      : "text";

  return (
    <input
      id={inputId}
      type={inputType}
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary",
        className,
      )}
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(event) =>
        onChange(normalizeTemplateFieldValue(field, event.target.value))
      }
    />
  );
}
