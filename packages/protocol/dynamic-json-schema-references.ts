import type { DynamicJsonSchema } from "./dynamic-json-schema-types.js";
import { DynamicJsonSchemaError, isJsonObject } from "./dynamic-json-schema-types.js";

export const MAP_OF_SCHEMAS = [
  "$defs",
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
] as const;

export const ARRAY_OF_SCHEMAS = ["allOf", "anyOf", "oneOf", "prefixItems"] as const;

export const SINGLE_SCHEMA = [
  "additionalItems",
  "additionalProperties",
  "contains",
  "contentSchema",
  "else",
  "if",
  "items",
  "not",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
] as const;

const STRUCTURAL_MAP_OF_SCHEMAS: readonly string[] = ["patternProperties", "properties"];
const STRUCTURAL_SINGLE_SCHEMA: readonly string[] = ["additionalProperties", "items"];

export function forEachDynamicJsonSubschema(
  schema: Record<string, unknown>,
  visit: (schema: unknown) => void,
  mode: "all" | "structural" = "all",
): void {
  const mapKeywords: readonly string[] =
    mode === "all" ? MAP_OF_SCHEMAS : STRUCTURAL_MAP_OF_SCHEMAS;
  for (const keyword of mapKeywords) {
    const schemas = schema[keyword];
    if (isJsonObject(schemas)) Object.values(schemas).forEach(visit);
  }
  for (const keyword of ARRAY_OF_SCHEMAS) {
    const schemas = schema[keyword];
    if (Array.isArray(schemas)) schemas.forEach(visit);
  }
  const singleKeywords: readonly string[] =
    mode === "all" ? SINGLE_SCHEMA : STRUCTURAL_SINGLE_SCHEMA;
  for (const keyword of singleKeywords) visit(schema[keyword]);
}

export function resolveLocalJsonPointer(root: Record<string, unknown>, reference: string): unknown {
  if (reference === "#") return root;
  if (!reference.startsWith("#/")) {
    throw new DynamicJsonSchemaError("JSON Schema references must use local JSON Pointers.");
  }
  let current: unknown = root;
  for (const encodedPart of reference.slice(2).split("/")) {
    const part = unescapeJsonPointerSegment(encodedPart);
    if (typeof current !== "object" || current === null || !Object.hasOwn(current, part)) {
      throw new DynamicJsonSchemaError(`JSON Schema reference does not resolve: ${reference}.`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Rewrites local references after moving a schema below a JSON Pointer path. */
export function relocateDynamicJsonSchemaReferences(
  schema: DynamicJsonSchema,
  pointerSegments: readonly string[],
): DynamicJsonSchema {
  const clone = structuredClone(schema);
  const prefix = pointerSegments.map(escapeJsonPointerSegment).join("/");
  const visited = new WeakSet<object>();

  const visit = (value: unknown): void => {
    if (typeof value === "boolean" || !isJsonObject(value) || visited.has(value)) return;
    visited.add(value);
    if (typeof value.$ref === "string") {
      value.$ref = value.$ref === "#" ? `#/${prefix}` : `#/${prefix}${value.$ref.slice(1)}`;
    }
    forEachDynamicJsonSubschema(value, visit);
  };

  visit(clone);
  return clone;
}

export function escapeJsonPointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function unescapeJsonPointerSegment(value: string): string {
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}
