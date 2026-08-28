import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod/v4";
import { closeUnspecifiedObjectAdditionalProperties } from "../../protocol/dynamic-json-schema-types.js";

export type { StandardJSONSchemaV1, StandardSchemaV1 };

/** A JSON object passed to jsonSchema(). The extension hardens Draft 2020-12 before interpretation. */
export type JsonSchemaDocument = { readonly [key: string]: unknown };

/** A schema that validates values and describes its accepted input as JSON Schema. */
export type StagehandSchema<Input = unknown, Output = Input> =
  | (StandardSchemaV1<Input, Output> & StandardJSONSchemaV1<Input, Output>)
  | z.ZodType<Output, Input>;

export type StagehandSchemaOutput<Schema extends StagehandSchema> =
  Schema extends z.ZodType<infer Output, unknown>
    ? Output
    : Schema extends StandardSchemaV1
      ? StandardSchemaV1.InferOutput<Schema>
      : never;

export class StagehandValidationError extends TypeError {
  readonly issues: readonly StandardSchemaV1.Issue[];

  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super(issues.map((issue) => issue.message).join("; ") || "Schema validation failed.");
    this.name = "StagehandValidationError";
    this.issues = issues;
  }
}

export class StagehandSchemaError extends TypeError {
  readonly vendor: string | undefined;
  readonly target: StandardJSONSchemaV1.Target | undefined;

  constructor(
    message: string,
    options?: {
      cause?: unknown;
      target?: StandardJSONSchemaV1.Target;
      vendor?: string;
    },
  ) {
    const vendor = options?.vendor;
    const context = [
      vendor ? `vendor: ${vendor}` : undefined,
      options?.target ? `target: ${options.target}` : undefined,
    ].filter(Boolean);
    super(context.length > 0 ? `${message} (${context.join(", ")})` : message, {
      cause: options?.cause,
    });
    this.name = "StagehandSchemaError";
    this.vendor = vendor;
    this.target = options?.target;
  }
}

export interface ResolvedExtractSchema<Output = unknown> {
  readonly jsonSchema: JsonSchemaDocument;
  validate(value: unknown): Promise<Output>;
}

const JSON_SCHEMA_TARGET = "draft-2020-12" as const;
const RAW_SCHEMA_VENDOR = "stagehand-json-schema";

/**
 * Adapts a complete Draft 2020-12 document for extraction.
 * The generic supplies a static type; Stagehand cannot infer it from JSON Schema.
 * The extension hardens and interprets the document; this helper does not validate values.
 */
export function jsonSchema<T = unknown>(document: JsonSchemaDocument): StagehandSchema<T, T> {
  const stored = cloneJsonDocument(document, RAW_SCHEMA_VENDOR);
  const convert = (options: StandardJSONSchemaV1.Options): Record<string, unknown> => {
    if (options.target !== JSON_SCHEMA_TARGET) {
      throw new StagehandSchemaError(
        `Raw JSON Schema adapters only support the "${JSON_SCHEMA_TARGET}" target.`,
        { target: options.target, vendor: RAW_SCHEMA_VENDOR },
      );
    }
    return cloneJsonDocument(stored, RAW_SCHEMA_VENDOR);
  };

  return {
    "~standard": {
      version: 1,
      vendor: RAW_SCHEMA_VENDOR,
      types: undefined,
      jsonSchema: { input: convert, output: convert },
      validate: (value) => ({ value: value as T }),
    },
  };
}

/** Converts one side of a Standard JSON Schema V1 implementation for the model. */
export function standardSchemaToJsonSchema(
  schema: StandardJSONSchemaV1,
  io: "input" | "output",
): JsonSchemaDocument {
  const standard = standardProperties(schema);
  const vendor = typeof standard?.vendor === "string" ? standard.vendor : undefined;
  if (!standard || standard.version !== 1) {
    throw new StagehandSchemaError("Schema must implement Standard Schema version 1.", { vendor });
  }
  if (!vendor) throw new StagehandSchemaError("Schema must provide a Standard Schema vendor name.");
  if (!hasJsonSchemaConverters(standard.jsonSchema)) {
    throw new StagehandSchemaError(
      `Schema does not provide both Standard JSON Schema V1 input and output converters.${converterGuidance(vendor)}`,
      { target: JSON_SCHEMA_TARGET, vendor },
    );
  }

  let converted: unknown;
  try {
    converted = standard.jsonSchema[io]({ target: JSON_SCHEMA_TARGET });
  } catch (cause) {
    throw new StagehandSchemaError(
      `Schema could not generate the required JSON Schema target "${JSON_SCHEMA_TARGET}".`,
      { cause, target: JSON_SCHEMA_TARGET, vendor },
    );
  }
  return providerJsonSchema(converted, vendor);
}

/** Validates a value and maps reported issues to StagehandValidationError. */
export async function validateStandardSchema<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
): Promise<StandardSchemaV1.InferOutput<S>> {
  const result = await schema["~standard"].validate(value);
  if (result.issues) throw new StagehandValidationError(result.issues);
  return result.value;
}

/** Internal argument discriminator. Partial standard implementations count as schema intent. */
export function isExtractSchemaIntent(value: unknown): boolean {
  return isRecordLike(value) && "~standard" in value;
}

/** Internal choke point for every custom schema accepted by extract(). */
export function resolveExtractSchema<Schema extends StagehandSchema>(
  value: Schema,
): ResolvedExtractSchema<StagehandSchemaOutput<Schema>>;
export function resolveExtractSchema(value: unknown): ResolvedExtractSchema;
export function resolveExtractSchema(value: unknown): ResolvedExtractSchema {
  const standard = standardProperties(value);
  if (!standard) {
    const guidance = isPlainObject(value)
      ? " Use jsonSchema() for raw Draft 2020-12 schemas."
      : "";
    throw new StagehandSchemaError(
      `Unsupported schema. Stagehand requires a native Standard Schema V1 and Standard JSON Schema V1 implementation.${guidance}`,
    );
  }

  const vendor = typeof standard.vendor === "string" ? standard.vendor : undefined;
  if (standard.version !== 1) {
    throw new StagehandSchemaError("Schema must implement Standard Schema version 1.", { vendor });
  }
  if (!vendor) throw new StagehandSchemaError("Schema must provide a Standard Schema vendor name.");
  if (typeof standard.validate !== "function") {
    throw new StagehandSchemaError(
      "Schema does not provide Standard Schema V1 validation through ~standard.validate().",
      { vendor },
    );
  }

  if (isZod4Schema(value, vendor) && !hasJsonSchemaConverters(standard.jsonSchema)) {
    return {
      jsonSchema: zodInputJsonSchema(value, vendor),
      validate: (candidate) => validateStandardSchema(value, candidate),
    };
  }

  if (!hasJsonSchemaConverters(standard.jsonSchema)) {
    throw new StagehandSchemaError(
      `Schema does not provide both Standard JSON Schema V1 input and output converters.${converterGuidance(vendor)}`,
      { target: JSON_SCHEMA_TARGET, vendor },
    );
  }

  const schema = value as StandardSchemaV1 & StandardJSONSchemaV1;
  return {
    jsonSchema: standardSchemaToJsonSchema(schema, "input"),
    validate: (candidate) => validateStandardSchema(schema, candidate),
  };
}

interface StandardProperties {
  readonly version?: unknown;
  readonly vendor?: unknown;
  readonly validate?: unknown;
  readonly jsonSchema?: unknown;
}

function standardProperties(value: unknown): StandardProperties | undefined {
  if (!isRecordLike(value)) return undefined;
  const standard = value["~standard"];
  return isPlainObject(standard) ? standard : undefined;
}

function hasJsonSchemaConverters(value: unknown): value is StandardJSONSchemaV1.Converter {
  return (
    isPlainObject(value) && typeof value.input === "function" && typeof value.output === "function"
  );
}

function isZod4Schema(value: unknown, vendor: string | undefined): value is z.ZodType {
  return vendor === "zod" && isRecordLike(value) && "_zod" in value;
}

function zodInputJsonSchema(schema: z.ZodType, vendor: string): JsonSchemaDocument {
  let converted: unknown;
  try {
    converted = z.toJSONSchema(schema, {
      io: "input",
      target: JSON_SCHEMA_TARGET,
    });
  } catch (cause) {
    throw new StagehandSchemaError(
      `Zod could not generate the required JSON Schema target "${JSON_SCHEMA_TARGET}".`,
      { cause, target: JSON_SCHEMA_TARGET, vendor },
    );
  }
  return providerJsonSchema(converted, vendor);
}

function providerJsonSchema(value: unknown, vendor: string): JsonSchemaDocument {
  const document = cloneJsonDocument(value, vendor);
  closeUnspecifiedObjectAdditionalProperties(document);
  return document;
}

function cloneJsonDocument(value: unknown, vendor: string): JsonSchemaDocument {
  if (!isPlainObject(value)) {
    throw new StagehandSchemaError("JSON Schema conversion must return an object.", { vendor });
  }
  try {
    return JSON.parse(JSON.stringify(value)) as JsonSchemaDocument;
  } catch (cause) {
    throw new StagehandSchemaError("JSON Schema conversion must return JSON-safe values.", {
      cause,
      vendor,
    });
  }
}

function converterGuidance(vendor: string | undefined): string {
  if (vendor === "zod") return " Upgrade to Zod 4.2.0 or newer.";
  if (vendor === "valibot") {
    return " Wrap the Valibot schema with @valibot/to-json-schema's toStandardJsonSchema().";
  }
  if (vendor === "effect") {
    return " Apply both Schema.toStandardSchemaV1() and Schema.toStandardJSONSchemaV1().";
  }
  return " Upgrade the schema library or use its official Standard JSON Schema adapter.";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecordLike(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}
