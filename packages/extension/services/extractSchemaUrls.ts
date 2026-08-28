import {
  isJsonObject,
  relocateDynamicJsonSchemaReferences,
  resolveLocalJsonPointer,
  type DynamicJsonSchema,
} from "../../protocol/dynamic-json-schema.js";
import {
  ARRAY_OF_SCHEMAS,
  MAP_OF_SCHEMAS,
  SINGLE_SCHEMA,
  mapDynamicJsonSubschemas,
} from "../../protocol/dynamic-json-schema-references.js";

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
  const rewritten = rewriteUrlSchemas(providerSchema, providerSchema, new WeakSet());

  return {
    jsonSchema: isJsonObject(rewritten) ? (rewritten as DynamicJsonSchema) : providerSchema,
    restoreUrls: (value, idToUrl) =>
      restoreSchemaValue(
        canonicalSchema,
        canonicalSchema,
        structuredClone(value),
        idToUrl,
        new Map(),
      ),
  };
}

function rewriteUrlSchemas(
  root: DynamicJsonSchema,
  schema: unknown,
  visited: WeakSet<object>,
): unknown {
  if (typeof schema === "boolean" || !isJsonObject(schema) || visited.has(schema)) return schema;
  visited.add(schema);

  if (typeof schema.$ref === "string") {
    const target = resolveLocalJsonPointer(root, schema.$ref);
    if (isUrlSchema(target)) return rewrittenUrlSchema(target);
    rewriteUrlSchemas(root, target, visited);
  }
  if (isUrlSchema(schema)) return rewrittenUrlSchema(schema);

  mapDynamicJsonSubschemas(schema, (child) => rewriteUrlSchemas(root, child, visited));
  return schema;
}

function isUrlSchema(schema: unknown): schema is Record<string, unknown> {
  return (
    isJsonObject(schema) &&
    schema.type === "string" &&
    typeof schema.format === "string" &&
    URL_FORMATS.has(schema.format)
  );
}

function rewrittenUrlSchema(source: Record<string, unknown>): Record<string, unknown> {
  const description = typeof source.description === "string" ? source.description.trim() : "";
  const base =
    "This field must be the element-ID in the form 'frameId-backendId' " + '(e.g. "0-432").';
  return {
    type: "string",
    pattern: ID_PATTERN_SOURCE,
    description: description
      ? `${base} that follows this user-defined description: ${description}`
      : base,
  };
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

    const restore = (childSchema: unknown, childValue: unknown) =>
      restoreSchemaValue(root, childSchema, childValue, idToUrl, activePairs);

    if (isJsonObject(value)) {
      const evaluatedKeys = new Set<string>();
      for (const keyword of MAP_OF_SCHEMAS) {
        const schemas = schema[keyword];
        if (!isJsonObject(schemas)) continue;
        if (keyword === "$defs" || keyword === "definitions") continue;
        if (keyword === "dependentSchemas") {
          for (const [key, childSchema] of Object.entries(schemas)) {
            if (Object.hasOwn(value, key)) value = restore(childSchema, value) as typeof value;
          }
          continue;
        }
        if (keyword === "patternProperties") {
          for (const [pattern, childSchema] of Object.entries(schemas)) {
            const regex = new RegExp(pattern, "u");
            for (const key of Object.keys(value)) {
              if (!regex.test(key)) continue;
              evaluatedKeys.add(key);
              value[key] = restore(childSchema, value[key]);
            }
          }
          continue;
        }
        for (const [key, childSchema] of Object.entries(schemas)) {
          if (!Object.hasOwn(value, key)) continue;
          evaluatedKeys.add(key);
          value[key] = restore(childSchema, value[key]);
        }
      }
      for (const keyword of ["additionalProperties", "unevaluatedProperties"] as const) {
        const childSchema = schema[keyword];
        if (!isJsonObject(childSchema)) continue;
        for (const key of Object.keys(value)) {
          if (evaluatedKeys.has(key)) continue;
          value[key] = restore(childSchema, value[key]);
          evaluatedKeys.add(key);
        }
      }
    }

    if (Array.isArray(value)) {
      let prefixLength = 0;
      for (const keyword of ARRAY_OF_SCHEMAS) {
        const schemas = schema[keyword];
        if (keyword !== "prefixItems" || !Array.isArray(schemas)) continue;
        prefixLength = schemas.length;
        for (let index = 0; index < Math.min(value.length, schemas.length); index += 1) {
          value[index] = restore(schemas[index], value[index]);
        }
      }
      for (const keyword of ["items", "additionalItems", "unevaluatedItems"] as const) {
        const childSchema = schema[keyword];
        if (!isJsonObject(childSchema)) continue;
        for (let index = prefixLength; index < value.length; index += 1) {
          value[index] = restore(childSchema, value[index]);
        }
      }
      if (isJsonObject(schema.contains)) {
        for (let index = 0; index < value.length; index += 1) {
          value[index] = restore(schema.contains, value[index]);
        }
      }
    }

    for (const keyword of ARRAY_OF_SCHEMAS) {
      if (keyword === "prefixItems") continue;
      const schemas = schema[keyword];
      if (!Array.isArray(schemas)) continue;
      for (const childSchema of schemas) value = restore(childSchema, value);
    }
    for (const keyword of SINGLE_SCHEMA) {
      if (
        keyword === "additionalItems" ||
        keyword === "additionalProperties" ||
        keyword === "contains" ||
        keyword === "contentSchema" ||
        keyword === "items" ||
        keyword === "not" ||
        keyword === "propertyNames" ||
        keyword === "unevaluatedItems" ||
        keyword === "unevaluatedProperties"
      ) {
        continue;
      }
      if (!Object.hasOwn(schema, keyword)) continue;
      value = restore(schema[keyword], value);
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
