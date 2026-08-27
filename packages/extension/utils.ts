import type { SchemaPathSegments } from "./types/private/internal.js";

/** Removes a leading provider segment from a model identifier. */
export function stripModelProvider(modelId: string): string {
  return modelId.includes("/") ? modelId.slice(modelId.indexOf("/") + 1) : modelId;
}

const ID_PATTERN = /^\d+-\d+$/;
const ID_PATTERN_SOURCE = "^\\d+-\\d+$";

/** Rewrites URL fields to temporary DOM-ID fields without compiling caller-owned schemas. */
export function transformJsonSchemaUrls(
  schema: Record<string, unknown>,
): [Record<string, unknown>, SchemaPathSegments[]] {
  const root = structuredClone(schema);
  const urlNodes = new WeakSet<object>();
  const paths: SchemaPathSegments[] = [];

  const visit = (
    value: unknown,
    currentPath: SchemaPathSegments["segments"],
    referencePath: Set<string>,
  ): void => {
    if (!isRecord(value)) return;
    if (urlNodes.has(value)) {
      paths.push({ segments: currentPath });
      return;
    }
    if (typeof value.$ref === "string") {
      if (referencePath.has(value.$ref)) return;
      visit(
        resolveLocalReference(root, value.$ref),
        currentPath,
        new Set(referencePath).add(value.$ref),
      );
      return;
    }
    if (value.type === "string" && (value.format === "uri" || value.format === "url")) {
      const userDescription = typeof value.description === "string" ? value.description : "";
      const base =
        "This field must be the element-ID in the form 'frameId-backendId' " + '(e.g. "0-432").';
      for (const key of Object.keys(value)) delete value[key];
      Object.assign(value, {
        type: "string",
        pattern: ID_PATTERN_SOURCE,
        description:
          userDescription.trim().length > 0
            ? `${base} that follows this user-defined description: ${userDescription}`
            : base,
      });
      urlNodes.add(value);
      paths.push({ segments: currentPath });
      return;
    }
    if (isRecord(value.properties)) {
      for (const [key, child] of Object.entries(value.properties)) {
        visit(child, [...currentPath, key], referencePath);
      }
    }
    if (isRecord(value.patternProperties)) {
      for (const [pattern, child] of Object.entries(value.patternProperties)) {
        visit(child, [...currentPath, { pattern }], referencePath);
      }
    }
    for (const keyword of ["additionalProperties", "unevaluatedProperties"] as const) {
      const child = value[keyword];
      if (isRecord(child)) visit(child, [...currentPath, "*"], referencePath);
    }
    if (value.items !== undefined) visit(value.items, [...currentPath, "*"], referencePath);
    if (Array.isArray(value.prefixItems)) {
      value.prefixItems.forEach((child, index) =>
        visit(child, [...currentPath, index], referencePath),
      );
    }
    for (const keyword of ["contains", "unevaluatedItems"] as const) {
      const child = value[keyword];
      if (isRecord(child)) visit(child, [...currentPath, "*"], referencePath);
    }
    for (const keyword of ["anyOf", "oneOf", "allOf"] as const) {
      const alternatives = value[keyword];
      if (Array.isArray(alternatives)) {
        alternatives.forEach((alternative) => visit(alternative, currentPath, referencePath));
      }
    }
    for (const keyword of ["if", "then", "else", "not"] as const) {
      if (isRecord(value[keyword])) visit(value[keyword], currentPath, referencePath);
    }
    if (isRecord(value.dependentSchemas)) {
      for (const child of Object.values(value.dependentSchemas)) {
        visit(child, currentPath, referencePath);
      }
    }
  };

  visit(root, [], new Set());
  return [root, deduplicatePaths(paths)];
}

/** Replaces extracted DOM IDs at selected paths with their original URLs. */
export function injectUrls(
  obj: unknown,
  path: SchemaPathSegments["segments"],
  idToUrlMapping: Record<string, string>,
): void {
  if (path.length === 0) return;
  const toId = (value: unknown): string | undefined => {
    if (typeof value === "number") return String(value);
    return typeof value === "string" && ID_PATTERN.test(value) ? value : undefined;
  };
  const [key, ...rest] = path;
  if (typeof key === "object") {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
    const pattern = new RegExp(key.pattern, "u");
    for (const [property, value] of Object.entries(obj)) {
      if (!pattern.test(property)) continue;
      if (rest.length === 0) {
        const id = toId(value);
        if (id !== undefined) (obj as Record<string, unknown>)[property] = idToUrlMapping[id] ?? "";
      } else {
        injectUrls(value, rest, idToUrlMapping);
      }
    }
    return;
  }
  if (key === "*") {
    if (Array.isArray(obj)) {
      if (rest.length === 0) {
        for (let index = 0; index < obj.length; index += 1) {
          const id = toId(obj[index]);
          if (id !== undefined) obj[index] = idToUrlMapping[id] ?? "";
        }
      } else {
        for (const item of obj) injectUrls(item, rest, idToUrlMapping);
      }
    } else if (obj && typeof obj === "object") {
      for (const [property, value] of Object.entries(obj)) {
        if (rest.length === 0) {
          const id = toId(value);
          if (id !== undefined)
            (obj as Record<string, unknown>)[property] = idToUrlMapping[id] ?? "";
        } else {
          injectUrls(value, rest, idToUrlMapping);
        }
      }
    }
    return;
  }
  if (obj && typeof obj === "object") {
    const record = obj as Record<string | number, unknown>;
    if (path.length === 1) {
      const id = toId(record[key]);
      if (id !== undefined) record[key] = idToUrlMapping[id] ?? "";
    } else {
      injectUrls(record[key], rest, idToUrlMapping);
    }
  }
}

export function hasModelProviderAuth(clientOptions: unknown): boolean {
  if (!clientOptions || typeof clientOptions !== "object") return false;
  const auth = (clientOptions as { auth?: unknown }).auth;
  return auth !== undefined && auth !== null;
}

export function getInheritableModelOptions<T extends object>(
  clientOptions: T | undefined,
): Partial<T> | undefined {
  if (!clientOptions) return undefined;
  const inheritableOptions = { ...(clientOptions as Record<string, unknown>) };
  delete inheritableOptions.apiKey;
  delete inheritableOptions.auth;
  return inheritableOptions as Partial<T>;
}

export function trimTrailingTextNode(path: string | undefined): string | undefined {
  return path?.replace(/\/text\(\)(\[\d+\])?$/iu, "");
}

export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.substring(1));
}

function resolveLocalReference(root: Record<string, unknown>, reference: string): unknown {
  if (reference === "#") return root;
  if (!reference.startsWith("#/")) {
    throw new TypeError(`Unsupported JSON Schema reference: ${reference}`);
  }
  let current: unknown = root;
  for (const encodedPart of reference.slice(2).split("/")) {
    const part = encodedPart.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isRecord(current) || !Object.hasOwn(current, part)) {
      throw new TypeError(`JSON Schema reference does not resolve: ${reference}`);
    }
    current = current[part];
  }
  return current;
}

function deduplicatePaths(paths: SchemaPathSegments[]): SchemaPathSegments[] {
  const seen = new Set<string>();
  return paths.filter(({ segments }) => {
    const key = JSON.stringify(segments);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
