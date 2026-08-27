export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DynamicJsonSchema = { [key: string]: JsonValue };

const DIALECTS = new Set([
  "https://json-schema.org/draft/2020-12/schema",
  "https://json-schema.org/draft/2020-12/schema#",
]);
const JSON_SCHEMA_TYPES = new Set([
  "array",
  "boolean",
  "integer",
  "null",
  "number",
  "object",
  "string",
]);
const STANDARD_VOCABULARIES = new Set([
  "https://json-schema.org/draft/2020-12/vocab/core",
  "https://json-schema.org/draft/2020-12/vocab/applicator",
  "https://json-schema.org/draft/2020-12/vocab/unevaluated",
  "https://json-schema.org/draft/2020-12/vocab/validation",
  "https://json-schema.org/draft/2020-12/vocab/meta-data",
  "https://json-schema.org/draft/2020-12/vocab/format-annotation",
  "https://json-schema.org/draft/2020-12/vocab/content",
]);
const ASSERTED_FORMATS = new Set([
  "date",
  "time",
  "date-time",
  "duration",
  "uri",
  "uri-reference",
  "uri-template",
  "url",
  "email",
  "hostname",
  "ipv4",
  "ipv6",
  "regex",
  "uuid",
  "json-pointer",
  "json-pointer-uri-fragment",
  "relative-json-pointer",
]);
const LIMITS = {
  bytes: 1024 * 1024,
  depth: 64,
  definitions: 2_048,
  nodes: 20_000,
  patternBytes: 4_096,
  properties: 10_000,
  references: 10_000,
  referenceDepth: 256,
  validationWork: 2_000_000,
  valueNodes: 100_000,
} as const;

const MAP_OF_SCHEMAS = [
  "$defs",
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
] as const;
const ARRAY_OF_SCHEMAS = ["allOf", "anyOf", "oneOf", "prefixItems"] as const;
const SINGLE_SCHEMA = [
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
const SUPPORTED_KEYWORDS = new Set([
  "$schema",
  "$id",
  "$ref",
  "$defs",
  "$anchor",
  "$dynamicRef",
  "$dynamicAnchor",
  "$vocabulary",
  "$comment",
  "definitions",
  "type",
  "enum",
  "const",
  "anyOf",
  "oneOf",
  "allOf",
  "not",
  "properties",
  "required",
  "additionalProperties",
  "patternProperties",
  "propertyNames",
  "minProperties",
  "maxProperties",
  "dependentSchemas",
  "dependentRequired",
  "items",
  "prefixItems",
  "additionalItems",
  "unevaluatedItems",
  "contains",
  "minContains",
  "maxContains",
  "minItems",
  "maxItems",
  "uniqueItems",
  "unevaluatedProperties",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "if",
  "then",
  "else",
  "title",
  "description",
  "default",
  "examples",
  "deprecated",
  "readOnly",
  "writeOnly",
  "contentEncoding",
  "contentMediaType",
  "contentSchema",
]);

export class DynamicJsonSchemaError extends TypeError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DynamicJsonSchemaError";
  }
}

/**
 * Copies and bounds untrusted draft 2020-12 JSON Schema before it reaches an
 * interpreter. Only local JSON Pointer references are accepted. The returned
 * value shares no mutable objects with the converter-owned input.
 */
export function validateDynamicJsonSchema(value: unknown): DynamicJsonSchema {
  if (!isObject(value)) {
    throw new DynamicJsonSchemaError("JSON Schema conversion must return an object.");
  }

  const counters = { definitions: 0, nodes: 0, properties: 0, references: 0 };
  const clone = cloneJsonValue(value, 0, new WeakSet(), counters);
  if (!isObject(clone)) {
    throw new DynamicJsonSchemaError("JSON Schema conversion must return an object.");
  }

  const dialect = clone.$schema;
  if (dialect !== undefined && (typeof dialect !== "string" || !DIALECTS.has(dialect))) {
    throw new DynamicJsonSchemaError(
      'JSON Schema must use draft 2020-12 when a "$schema" dialect is declared.',
    );
  }

  validateSchemaNode(clone, "#", true, new Set());
  validateReferenceChains(clone);

  const serialized = JSON.stringify(clone);
  if (new TextEncoder().encode(serialized).byteLength > LIMITS.bytes) {
    throw limitError(`JSON Schema exceeds the ${LIMITS.bytes}-byte size limit.`);
  }
  return clone as DynamicJsonSchema;
}

/** Rejects values whose interpreted validation would exceed a fixed work budget. */
export function assertDynamicValidationWork(schema: DynamicJsonSchema, value: unknown): void {
  const schemaWeight = countValidationWeight(schema, schema, new Set(), 0);
  const valueNodes = countValueNodes(value, new WeakSet());
  if (schemaWeight * Math.max(1, valueNodes) > LIMITS.validationWork) {
    throw limitError(
      `Dynamic JSON Schema validation exceeds the ${LIMITS.validationWork}-operation work limit.`,
    );
  }
}

function cloneJsonValue(
  value: unknown,
  depth: number,
  ancestors: WeakSet<object>,
  counters: { definitions: number; nodes: number; properties: number; references: number },
): JsonValue {
  if (depth > LIMITS.depth) {
    throw limitError(`JSON Schema exceeds the maximum depth of ${LIMITS.depth}.`);
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value !== "object") {
    throw new DynamicJsonSchemaError("JSON Schema must contain only JSON-safe values.");
  }
  if (ancestors.has(value)) {
    throw new DynamicJsonSchemaError("JSON Schema must not contain cyclic JavaScript objects.");
  }
  counters.nodes += 1;
  if (counters.nodes > LIMITS.nodes) {
    throw limitError(`JSON Schema exceeds the ${LIMITS.nodes}-node limit.`);
  }
  ancestors.add(value);

  if (Array.isArray(value)) {
    validateArrayProperties(value);
    const result: JsonValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        throw new DynamicJsonSchemaError("JSON Schema arrays must not contain sparse entries.");
      }
      result.push(cloneJsonValue(value[index], depth + 1, ancestors, counters));
    }
    ancestors.delete(value);
    return result;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new DynamicJsonSchemaError("JSON Schema objects must use a plain or null prototype.");
  }

  const result: Record<string, JsonValue> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      throw new DynamicJsonSchemaError("JSON Schema objects must not contain symbol keys.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable) continue;
    if (!("value" in descriptor)) {
      throw new DynamicJsonSchemaError("JSON Schema objects must not contain accessors.");
    }
    const entry = descriptor.value;
    if (key === "properties" && isObject(entry)) {
      counters.properties += enumerableStringKeys(entry).length;
      if (counters.properties > LIMITS.properties) {
        throw limitError(`JSON Schema exceeds the ${LIMITS.properties}-property limit.`);
      }
    }
    if (key === "$defs" && isObject(entry)) {
      counters.definitions += enumerableStringKeys(entry).length;
      if (counters.definitions > LIMITS.definitions) {
        throw limitError(`JSON Schema exceeds the ${LIMITS.definitions}-$defs limit.`);
      }
    }
    if (key === "$ref" || key === "$dynamicRef") {
      counters.references += 1;
      if (counters.references > LIMITS.references) {
        throw limitError(`JSON Schema exceeds the ${LIMITS.references}-$ref limit.`);
      }
    }
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value: cloneJsonValue(entry, depth + 1, ancestors, counters),
      writable: true,
    });
  }
  ancestors.delete(value);
  return result;
}

function validateSchemaNode(
  value: unknown,
  path: string,
  root: boolean,
  visited: Set<object>,
): void {
  if (typeof value === "boolean") return;
  if (!isObject(value)) throw schemaShapeError(path, "must be a JSON Schema object or boolean");
  if (visited.has(value)) return;
  visited.add(value);

  for (const keyword of enumerableStringKeys(value)) {
    if (!SUPPORTED_KEYWORDS.has(keyword)) {
      throw schemaShapeError(`${path}/${escapePointer(keyword)}`, "is not supported");
    }
  }

  if (!root && value.$id !== undefined) {
    throw schemaShapeError(`${path}/$id`, "must not create a nested identifier scope");
  }
  if (
    !root &&
    value.$schema !== undefined &&
    (typeof value.$schema !== "string" || !DIALECTS.has(value.$schema))
  ) {
    throw schemaShapeError(`${path}/$schema`, "must not declare a conflicting dialect");
  }
  for (const keyword of [
    "$anchor",
    "$comment",
    "$dynamicAnchor",
    "$id",
    "$schema",
    "contentEncoding",
    "contentMediaType",
    "description",
    "format",
    "title",
  ]) {
    if (value[keyword] !== undefined && typeof value[keyword] !== "string") {
      throw schemaShapeError(`${path}/${keyword}`, "must be a string");
    }
  }
  for (const keyword of ["$ref", "$dynamicRef"] as const) {
    const reference = value[keyword];
    if (reference !== undefined) validateLocalReference(reference, `${path}/${keyword}`);
  }
  validateTypeKeyword(value.type, `${path}/type`);

  for (const keyword of MAP_OF_SCHEMAS) {
    const map = value[keyword];
    if (map === undefined) continue;
    if (!isObject(map)) throw schemaShapeError(`${path}/${keyword}`, "must be an object");
    for (const key of enumerableStringKeys(map)) {
      if (keyword === "patternProperties") validatePattern(key, `${path}/${keyword}/${key}`);
      validateSchemaNode(map[key], `${path}/${keyword}/${escapePointer(key)}`, false, visited);
    }
  }
  for (const keyword of ARRAY_OF_SCHEMAS) {
    const schemas = value[keyword];
    if (schemas === undefined) continue;
    if (!Array.isArray(schemas) || schemas.length === 0) {
      throw schemaShapeError(`${path}/${keyword}`, "must be a non-empty array of schemas");
    }
    schemas.forEach((schema, index) =>
      validateSchemaNode(schema, `${path}/${keyword}/${index}`, false, visited),
    );
  }
  for (const keyword of SINGLE_SCHEMA) {
    const schema = value[keyword];
    if (schema !== undefined) validateSchemaNode(schema, `${path}/${keyword}`, false, visited);
  }

  validateStringArray(value.required, `${path}/required`, true);
  validateDependentRequired(value.dependentRequired, `${path}/dependentRequired`);
  if (value.enum !== undefined && (!Array.isArray(value.enum) || value.enum.length === 0)) {
    throw schemaShapeError(`${path}/enum`, "must be a non-empty array");
  }
  if (value.pattern !== undefined) validatePattern(value.pattern, `${path}/pattern`);
  if (value.$vocabulary !== undefined) validateVocabulary(value.$vocabulary, `${path}/$vocabulary`);
  if (value.format !== undefined) validateFormat(value.format, value.pattern, `${path}/format`);
  if (value.examples !== undefined && !Array.isArray(value.examples)) {
    throw schemaShapeError(`${path}/examples`, "must be an array");
  }

  for (const keyword of ["deprecated", "readOnly", "uniqueItems", "writeOnly"]) {
    if (value[keyword] !== undefined && typeof value[keyword] !== "boolean") {
      throw schemaShapeError(`${path}/${keyword}`, "must be a boolean");
    }
  }
  for (const keyword of [
    "maxContains",
    "maxItems",
    "maxLength",
    "maxProperties",
    "minContains",
    "minItems",
    "minLength",
    "minProperties",
  ]) {
    if (value[keyword] !== undefined)
      validateNonNegativeInteger(value[keyword], `${path}/${keyword}`);
  }
  for (const keyword of ["exclusiveMaximum", "exclusiveMinimum", "maximum", "minimum"]) {
    if (value[keyword] !== undefined && !isFiniteNumber(value[keyword])) {
      throw schemaShapeError(`${path}/${keyword}`, "must be a finite number");
    }
  }
  if (
    value.multipleOf !== undefined &&
    (!isFiniteNumber(value.multipleOf) || value.multipleOf <= 0)
  ) {
    throw schemaShapeError(`${path}/multipleOf`, "must be a positive finite number");
  }
  validateRange(value, "minItems", "maxItems", path);
  validateRange(value, "minLength", "maxLength", path);
  validateRange(value, "minProperties", "maxProperties", path);
  validateRange(value, "minContains", "maxContains", path);
}

function validateReferenceChains(root: Record<string, unknown>): void {
  const visit = (value: unknown, referenceDepth: number, path: Set<object>): void => {
    if (typeof value !== "object" || value === null || path.has(value)) return;
    path.add(value);
    const record = Array.isArray(value) ? undefined : (value as Record<string, unknown>);
    for (const keyword of ["$ref", "$dynamicRef"] as const) {
      const reference = record?.[keyword];
      if (typeof reference !== "string") continue;
      if (referenceDepth >= LIMITS.referenceDepth) {
        throw limitError(`JSON Schema exceeds the ${LIMITS.referenceDepth}-reference chain limit.`);
      }
      visit(resolveLocalJsonPointer(root, reference), referenceDepth + 1, path);
    }
    for (const entry of Array.isArray(value) ? value : Object.values(value)) {
      visit(entry, referenceDepth, path);
    }
    path.delete(value);
  };
  visit(root, 0, new Set());
}

function resolveLocalJsonPointer(root: Record<string, unknown>, reference: string): unknown {
  if (reference === "#") return root;
  if (!reference.startsWith("#/")) {
    throw new DynamicJsonSchemaError("JSON Schema references must use local JSON Pointers.");
  }
  let current: unknown = root;
  for (const encodedPart of reference.slice(2).split("/")) {
    const part = encodedPart.replaceAll("~1", "/").replaceAll("~0", "~");
    if (typeof current !== "object" || current === null || !Object.hasOwn(current, part)) {
      throw new DynamicJsonSchemaError(`JSON Schema reference does not resolve: ${reference}.`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function countValidationWeight(
  value: unknown,
  root: Record<string, unknown>,
  path: Set<object>,
  referenceDepth: number,
): number {
  if (typeof value !== "object" || value === null || path.has(value)) return 1;
  path.add(value);
  let weight = 1;
  if (!Array.isArray(value)) {
    for (const keyword of ["$ref", "$dynamicRef"] as const) {
      const reference = (value as Record<string, unknown>)[keyword];
      if (typeof reference !== "string") continue;
      if (referenceDepth >= LIMITS.referenceDepth) return LIMITS.validationWork + 1;
      weight += countValidationWeight(
        resolveLocalJsonPointer(root, reference),
        root,
        path,
        referenceDepth + 1,
      );
      if (weight > LIMITS.validationWork) return weight;
    }
  }
  for (const [key, entry] of Object.entries(value)) {
    const multiplier = key === "allOf" || key === "anyOf" || key === "oneOf" ? 2 : 1;
    weight += multiplier * countValidationWeight(entry, root, path, referenceDepth);
    if (weight > LIMITS.validationWork) return weight;
  }
  path.delete(value);
  return weight;
}

function countValueNodes(value: unknown, seen: WeakSet<object>): number {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return 1;
  }
  if (typeof value !== "object") {
    throw new DynamicJsonSchemaError("Dynamic JSON values must contain only JSON-safe values.");
  }
  if (seen.has(value)) {
    throw new DynamicJsonSchemaError(
      "Dynamic JSON values must not contain cycles or mutable shared references.",
    );
  }
  seen.add(value);
  if (Array.isArray(value)) {
    validateDynamicValueArray(value);
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new DynamicJsonSchemaError(
        "Dynamic JSON values must use plain or null-prototype objects.",
      );
    }
  }
  let count = 1;
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") continue;
    if (typeof key === "symbol") {
      throw new DynamicJsonSchemaError("Dynamic JSON values must not contain symbol keys.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable) continue;
    if (!("value" in descriptor)) {
      throw new DynamicJsonSchemaError("Dynamic JSON values must not contain accessors.");
    }
    count += countValueNodes(descriptor.value, seen);
    if (count > LIMITS.valueNodes) {
      throw limitError(`Dynamic JSON values exceed the ${LIMITS.valueNodes}-node limit.`);
    }
  }
  return count;
}

function validateDynamicValueArray(value: unknown[]): void {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      throw new DynamicJsonSchemaError("Dynamic JSON arrays must not contain sparse entries.");
    }
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue;
    if (typeof key === "symbol" || !/^(0|[1-9]\d*)$/u.test(key) || Number(key) >= value.length) {
      throw new DynamicJsonSchemaError("Dynamic JSON arrays must not contain custom properties.");
    }
  }
}

function validateArrayProperties(value: unknown[]): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      throw new DynamicJsonSchemaError("JSON Schema arrays must not contain symbol keys.");
    }
    if (key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) {
      throw new DynamicJsonSchemaError("JSON Schema arrays must not contain accessors.");
    }
    if (!/^(0|[1-9]\d*)$/u.test(key) || Number(key) >= value.length) {
      throw new DynamicJsonSchemaError("JSON Schema arrays must not contain custom properties.");
    }
  }
}

function validateTypeKeyword(value: unknown, path: string): void {
  if (value === undefined) return;
  const values = typeof value === "string" ? [value] : value;
  if (!Array.isArray(values) || values.length === 0) {
    throw schemaShapeError(path, "must be a JSON Schema type name or non-empty array of names");
  }
  if (
    values.some((entry) => typeof entry !== "string" || !JSON_SCHEMA_TYPES.has(entry)) ||
    new Set(values).size !== values.length
  ) {
    throw schemaShapeError(path, "must contain unique JSON Schema type names");
  }
}

function validateStringArray(value: unknown, path: string, unique: boolean): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw schemaShapeError(path, "must be an array of strings");
  }
  if (unique && new Set(value).size !== value.length) {
    throw schemaShapeError(path, "must contain unique strings");
  }
}

function validateDependentRequired(value: unknown, path: string): void {
  if (value === undefined) return;
  if (!isObject(value)) throw schemaShapeError(path, "must be an object of string arrays");
  for (const key of enumerableStringKeys(value)) {
    validateStringArray(value[key], `${path}/${escapePointer(key)}`, true);
  }
}

function validateVocabulary(value: unknown, path: string): void {
  if (!isObject(value) || Object.values(value).some((entry) => typeof entry !== "boolean")) {
    throw schemaShapeError(path, "must be an object with boolean values");
  }
  for (const vocabulary of Object.keys(value)) {
    if (!STANDARD_VOCABULARIES.has(vocabulary)) {
      throw schemaShapeError(`${path}/${escapePointer(vocabulary)}`, "is not supported");
    }
  }
}

function validateFormat(value: unknown, pattern: unknown, path: string): void {
  if (typeof value !== "string") throw schemaShapeError(path, "must be a string");
  if (!ASSERTED_FORMATS.has(value) && typeof pattern !== "string") {
    throw schemaShapeError(path, "must use a supported format or provide an enforcing pattern");
  }
}

function validatePattern(value: unknown, path: string): void {
  if (typeof value !== "string") throw schemaShapeError(path, "must be a string");
  if (new TextEncoder().encode(value).byteLength > LIMITS.patternBytes) {
    throw limitError(`JSON Schema patterns must be no larger than ${LIMITS.patternBytes} bytes.`);
  }
  try {
    new RegExp(value, "u");
  } catch (cause) {
    throw new DynamicJsonSchemaError(`Invalid JSON Schema pattern at ${path}.`, { cause });
  }
  if (hasUnsafeRegexStructure(value)) {
    throw schemaShapeError(path, "uses a potentially exponential regular expression");
  }
}

function hasUnsafeRegexStructure(pattern: string): boolean {
  const nestedQuantifier =
    /\((?:[^()\\]|\\.)*(?:[+*]|\{\d+(?:,\d*)?\})(?:[^()\\]|\\.)*\)(?:[+*]|\{\d+(?:,\d*)?\})/u;
  const quantifiedAlternation = /\((?:[^()\\]|\\.)*\|(?:[^()\\]|\\.)*\)(?:[+*]|\{\d+(?:,\d*)?\})/u;
  const repeatedWildcard = /\.\*(?:[^|)]{0,32})\.\*/u;
  const backReference = /\\[1-9]/u;
  return (
    nestedQuantifier.test(pattern) ||
    quantifiedAlternation.test(pattern) ||
    repeatedWildcard.test(pattern) ||
    backReference.test(pattern)
  );
}

function validateLocalReference(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || (value !== "#" && !value.startsWith("#/"))) {
    throw schemaShapeError(path, "must be a local and self-contained JSON Pointer reference");
  }
}

function validateNonNegativeInteger(value: unknown, path: string): void {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw schemaShapeError(path, "must be a non-negative integer");
  }
}

function validateRange(
  value: Record<string, unknown>,
  minimum: string,
  maximum: string,
  path: string,
): void {
  if (
    typeof value[minimum] === "number" &&
    typeof value[maximum] === "number" &&
    value[minimum] > value[maximum]
  ) {
    throw schemaShapeError(`${path}/${minimum}`, `must not exceed ${maximum}`);
  }
}

function enumerableStringKeys(value: object): string[] {
  return Reflect.ownKeys(value).filter(
    (key): key is string =>
      typeof key === "string" && Object.getOwnPropertyDescriptor(value, key)?.enumerable === true,
  );
}

function schemaShapeError(path: string, message: string): DynamicJsonSchemaError {
  return new DynamicJsonSchemaError(`JSON Schema keyword at ${path} ${message}.`);
}

function limitError(message: string): DynamicJsonSchemaError {
  return new DynamicJsonSchemaError(message);
}

function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
