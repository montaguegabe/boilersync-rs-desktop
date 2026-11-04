export { TemplateInput } from "./components/TemplateInput";
export type { TemplateInputProps } from "./components/TemplateInput";
export { TemplateFieldList } from "./components/TemplateFieldList";
export type { TemplateFieldListProps } from "./components/TemplateFieldList";
export { DiffViewer } from "multi-react";
export type {
  Repository,
  FileEntry,
  DiffViewerProps,
  ContextMenuTarget,
  ContextMenuAction,
  NativeContextMenuItem,
  DiscardTarget,
  HistoryCommit,
  HistoryGroup,
  HistoryCommitRef,
  HistoryRepoDiff,
} from "multi-react";
export { cn } from "multi-react";
export { DiffSelection, DiffSelectionType } from "multi-react";
export { formatPatch, formatDiscardPatch } from "multi-react";
export {
  getDisplayPath,
  getFileStatus,
  buildRepoFileEntries,
} from "multi-react";
export { parseDiff } from "multi-react";
export { LineType } from "multi-react";
export type { DiffFile, DiffBlock, DiffLine } from "multi-react";
export type {
  FieldValues,
  TemplateDetails,
  TemplateInputField,
  TemplateListEntry,
  TemplateSource,
} from "./types/templates";
export {
  buildInitialFieldValues,
  getMissingRequiredTemplateFields,
  getTemplateFieldLabel,
  getTemplateFieldType,
  isEmptyTemplateValue,
  normalizeTemplateFieldValue,
  serializeTemplateFieldValues,
} from "./utils/templateFields";
