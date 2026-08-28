import {
  isJsonObject,
  relocateDynamicJsonSchemaReferences,
  resolveLocalJsonPointer,
  type DynamicJsonSchema,
} from "../../protocol/dynamic-json-schema.js";
import { forEachDynamicJsonSubschema } from "../../protocol/dynamic-json-schema-references.js";

const ID_PATTERN = /^\d+-\d+$/u;
const ID_PATTERN_SOURCE = "^\\d+-\\d+$";
const URL_FORMATS = new Set(["uri", "url"]);

export interface UrlAwareExtractionSchema {
  readonly jsonSchema: DynamicJsonSchema;
  restoreUrls(value: unknown, idToUrl: Readonly<Record<string, string>>): unknown;
}

/** Creates the provider schema and retains its canonical schema for URL restoration. */
export function createUrlAwareExtractionSchema(
  schema: DynamicJsonSchema,
): UrlAwareExtractionSchema {
  const canonicalSchema = schema;
  const providerSchema = structuredClone(canonicalSchema);
  rewriteUrlSchemas(providerSchema, providerSchema, new WeakSet());

  return {
    jsonSchema: providerSchema,
    restoreUrls: (value, idToUrl) =>
      restoreSchemaValue(canonicalSchema, canonicalSchema, value, idToUrl, new Map()),
  };
}

function rewriteUrlSchemas(
  root: DynamicJsonSchema,
  schema: unknown,
  visited: WeakSet<object>,
): void {
  if (typeof schema === "boolean" || !isJsonObject(schema) || visited.has(schema)) return;
  visited.add(schema);

  if (typeof schema.$ref === "string") {
    const target = resolveLocalJsonPointer(root, schema.$ref);
    if (isUrlSchema(target)) {
      rewriteUrlSchema(schema, target);
      return;
    }
    rewriteUrlSchemas(root, target, visited);
  }
  if (isUrlSchema(schema)) {
    rewriteUrlSchema(schema, schema);
    return;
  }

  forEachDynamicJsonSubschema(
    schema,
    (child) => rewriteUrlSchemas(root, child, visited),
    "structural",
  );
}

function isUrlSchema(schema: unknown): schema is Record<string, unknown> {
  return (
    isJsonObject(schema) &&
    schema.type === "string" &&
    typeof schema.format === "string" &&
    URL_FORMATS.has(schema.format)
  );
}

function rewriteUrlSchema(
  destination: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  const description = typeof source.description === "string" ? source.description.trim() : "";
  const base =
    "This field must be the element-ID in the form 'frameId-backendId' " + '(e.g. "0-432").';
  for (const key of Object.keys(destination)) delete destination[key];
  Object.assign(destination, {
    type: "string",
    pattern: ID_PATTERN_SOURCE,
    description: description
      ? `${base} that follows this user-defined description: ${description}`
      : base,
  });
}

function restoreSchemaValue(
  root: DynamicJsonSchema,
  schema: unknown,
  candidate: unknown,
  idToUrl: Readonly<Record<string, string>>,
  activePairs: Map<object, Set<unknown>>,
): unknown {
  if (typeof schema === "boolean" || !isJsonObject(schema)) return candidate;
  const activeValues = activePairs.get(schema) ?? new Set<unknown>();
  if (activeValues.has(candidate)) return candidate;
  if (!activePairs.has(schema)) activePairs.set(schema, activeValues);
  activeValues.add(candidate);

  const originalCandidate = candidate;
  try {
    let value = candidate;
    if (typeof schema.$ref === "string") {
      value = restoreSchemaValue(
        root,
        resolveLocalJsonPointer(root, schema.$ref),
        value,
        idToUrl,
        activePairs,
      );
    }
    if (
      schema.type === "string" &&
      typeof schema.format === "string" &&
      URL_FORMATS.has(schema.format)
    ) {
      const id = toDomId(value);
      return id === undefined ? value : (idToUrl[id] ?? "");
    }

    if (isJsonObject(value)) {
      const evaluatedKeys = new Set<string>();
      const properties = schema.properties;
      if (isJsonObject(properties)) {
        for (const [key, childSchema] of Object.entries(properties)) {
          if (Object.hasOwn(value, key)) {
            evaluatedKeys.add(key);
            value[key] = restoreSchemaValue(root, childSchema, value[key], idToUrl, activePairs);
          }
        }
      }
      const patternProperties = schema.patternProperties;
      if (isJsonObject(patternProperties)) {
        for (const [pattern, childSchema] of Object.entries(patternProperties)) {
          const regex = new RegExp(pattern, "u");
          for (const key of Object.keys(value)) {
            if (regex.test(key)) {
              evaluatedKeys.add(key);
              value[key] = restoreSchemaValue(root, childSchema, value[key], idToUrl, activePairs);
            }
          }
        }
      }
      const additionalProperties = schema.additionalProperties;
      if (isJsonObject(additionalProperties)) {
        for (const key of Object.keys(value)) {
          if (evaluatedKeys.has(key)) continue;
          value[key] = restoreSchemaValue(
            root,
            additionalProperties,
            value[key],
            idToUrl,
            activePairs,
          );
          evaluatedKeys.add(key);
        }
      }
    }

    if (Array.isArray(value)) {
      if (Array.isArray(schema.prefixItems)) {
        for (let index = 0; index < Math.min(value.length, schema.prefixItems.length); index += 1) {
          value[index] = restoreSchemaValue(
            root,
            schema.prefixItems[index],
            value[index],
            idToUrl,
            activePairs,
          );
        }
      }
      if (isJsonObject(schema.items)) {
        const start = Array.isArray(schema.prefixItems) ? schema.prefixItems.length : 0;
        for (let index = start; index < value.length; index += 1) {
          value[index] = restoreSchemaValue(root, schema.items, value[index], idToUrl, activePairs);
        }
      }
    }

    for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
      const schemas = schema[keyword];
      if (!Array.isArray(schemas)) continue;
      for (const childSchema of schemas) {
        value = restoreSchemaValue(root, childSchema, value, idToUrl, activePairs);
      }
    }
    return value;
  } finally {
    activeValues.delete(originalCandidate);
  }
}

function toDomId(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && ID_PATTERN.test(value) ? value : undefined;
}

export function wrapRootSchema(schema: DynamicJsonSchema, key: string): DynamicJsonSchema {
  for (const keyword of ["$id", "$anchor"] as const) {
    if (schema[keyword] !== undefined) {
      throw new TypeError(
        `Cannot wrap a non-object JSON Schema containing ${keyword}; relocation would change its reference scope.`,
      );
    }
  }
  const { $schema, ...body } = relocateDynamicJsonSchemaReferences(schema, ["properties", key]);
  return {
    ...($schema === undefined ? {} : { $schema }),
    type: "object",
    properties: { [key]: body },
    required: [key],
    additionalProperties: false,
  } as DynamicJsonSchema;
}

/** Whether every value accepted at the root must be an object. */
export function schemaRequiresObject(root: DynamicJsonSchema): boolean {
  const visit = (schema: unknown, path: Set<object>): boolean => {
    if (!isJsonObject(schema) || path.has(schema)) return false;
    path.add(schema);
    try {
      if (schema.type === "object") return true;
      if (Array.isArray(schema.type) && schema.type.length === 1 && schema.type[0] === "object") {
        return true;
      }
      if (
        typeof schema.$ref === "string" &&
        visit(resolveLocalJsonPointer(root, schema.$ref), path)
      ) {
        return true;
      }
      if (Array.isArray(schema.allOf) && schema.allOf.some((child) => visit(child, path))) {
        return true;
      }
      for (const keyword of ["anyOf", "oneOf"] as const) {
        const branches = schema[keyword];
        if (
          Array.isArray(branches) &&
          branches.length > 0 &&
          branches.every((child) => visit(child, path))
        ) {
          return true;
        }
      }
      return false;
    } finally {
      path.delete(schema);
    }
  };
  return visit(root, new Set());
}
