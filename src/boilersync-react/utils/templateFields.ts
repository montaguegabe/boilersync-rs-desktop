import type { FieldValues, TemplateInputField } from "../types/templates";

export function getTemplateFieldType(field: TemplateInputField): string {
  return (field.type ?? "text").toLowerCase();
}

export function getTemplateFieldLabel(field: TemplateInputField): string {
  return field.label || field.name;
}

export function buildInitialFieldValues(
  fields: TemplateInputField[],
): FieldValues {
  const initialValues: FieldValues = {};
  fields.forEach((field) => {
    if (field.default !== undefined) {
      initialValues[field.name] = field.default;
      return;
    }
    if (getTemplateFieldType(field) === "boolean") {
      initialValues[field.name] = false;
      return;
    }
    initialValues[field.name] = "";
  });
  return initialValues;
}

export function isEmptyTemplateValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

export function normalizeTemplateFieldValue(
  field: TemplateInputField,
  raw: string,
): unknown {
  const normalizedType = getTemplateFieldType(field);
  if (normalizedType === "boolean") {
    return raw === "true";
  }
  if (normalizedType === "number" || normalizedType === "float") {
    return raw.trim() === "" ? "" : Number(raw);
  }
  if (normalizedType === "integer" || normalizedType === "int") {
    return raw.trim() === "" ? "" : parseInt(raw, 10);
  }
  return raw;
}

export function serializeTemplateFieldValues(
  fields: TemplateInputField[],
  values: FieldValues,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  fields.forEach((field) => {
    const value = values[field.name];
    if (
      isEmptyTemplateValue(value) &&
      !field.required &&
      field.default === undefined
    ) {
      return;
    }
    output[field.name] = value;
  });
  return output;
}

export function getMissingRequiredTemplateFields(
  fields: TemplateInputField[],
  values: FieldValues,
): TemplateInputField[] {
  return fields.filter(
    (field) => field.required && isEmptyTemplateValue(values[field.name]),
  );
}
