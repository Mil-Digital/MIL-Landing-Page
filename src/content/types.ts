/**
 * Field & section definitions for the CMS.
 *
 * The schema (schema.ts) is the single source of truth:
 *  - the admin forms are generated from it,
 *  - the public renderer uses its defaults as fallback content,
 *  - the seed SQL is generated from it.
 */

export type ImageValue = { url: string; alt?: string; width?: number; height?: number };
export type VideoValue = { url: string };

type Base = {
  key: string;
  label: string;
  help?: string;
  required?: boolean;
  /** Only show this field (inside a repeater item) when sibling `field` equals `equals`. */
  showIf?: { field: string; equals: string };
};

export type TextField = Base & { type: "text"; placeholder?: string; maxLength?: number };
export type TextareaField = Base & { type: "textarea"; rows?: number; maxLength?: number };
/**
 * Short formatted copy. Supports:
 *   *text*    -> highlighted (rendered with `highlight` tag/class)
 *   [[text]]  -> keep words together on one line (no wrap)
 *   newline   -> line break (only if allowBreaks)
 */
export type InlineField = Base & {
  type: "inline";
  highlight?: "accent" | "em" | "b" | "i";
  allowBreaks?: boolean;
  multiline?: boolean;
};
export type UrlField = Base & { type: "url"; placeholder?: string };
export type NumberField = Base & { type: "number"; min?: number; max?: number; step?: number };
export type ImageField = Base & { type: "image"; withAlt?: boolean; decorative?: boolean };
export type VideoField = Base & { type: "video" };
export type IconField = Base & { type: "icon"; set: "tag" | "card" };
export type SelectField = Base & { type: "select"; options: { value: string; label: string }[] };
export type ListField = Base & { type: "list"; itemLabel: string; placeholder?: string };
export type RepeaterField = Base & {
  type: "repeater";
  itemLabel: string;
  /** Field key used as the collapsed title of each item. */
  titleKey?: string;
  fields: Field[];
  min?: number;
  max?: number;
  /** Disallow adding/removing (fixed number of items, e.g. the 3 workflow stages). */
  fixed?: boolean;
  newItem: Record<string, unknown>;
};

export type Field =
  | TextField
  | TextareaField
  | InlineField
  | UrlField
  | NumberField
  | ImageField
  | VideoField
  | IconField
  | SelectField
  | ListField
  | RepeaterField;

export type FieldType = Field["type"];

export type FieldGroup = { title: string; description?: string; fields: Field[] };

export type SectionDef = {
  id: string;
  label: string;
  description: string;
  /** lucide-style icon name used in the admin sidebar */
  icon: string;
  groups: FieldGroup[];
};

export type SectionContent = Record<string, unknown>;
export type SiteContent = Record<string, SectionContent>;
