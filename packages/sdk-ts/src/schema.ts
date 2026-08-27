import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import {
  DynamicJsonSchemaError,
  validateDynamicJsonSchema,
} from "../../protocol/dynamic-json-schema.ts";
import type { DynamicJsonSchema, JsonValue } from "../../protocol/dynamic-json-schema.ts";

export type { StandardJSONSchemaV1, StandardSchemaV1 };

export type RawJsonSchema = DynamicJsonSchema;
export type { JsonValue };

/** A schema that validates values and describes its accepted input as JSON Schema. */
export type StagehandSchema<Input = unknown, Output = Input> = StandardSchemaV1<Input, Output> &
  StandardJSONSchemaV1<Input, Output>;

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
  readonly target: typeof JSON_SCHEMA_TARGET | undefined;

  constructor(
    message: string,
    options?: { cause?: unknown; target?: typeof JSON_SCHEMA_TARGET; vendor?: string },
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
  readonly jsonSchema: RawJsonSchema;
  validate(value: unknown): Promise<Output>;
}

const JSON_SCHEMA_TARGET = "draft-2020-12" as const;

/** Internal argument discriminator. Partial standard implementations count as schema intent. */
export function isExtractSchemaIntent(value: unknown): boolean {
  return isRecordLike(value) && "~standard" in value;
}

/** Internal choke point for every custom schema accepted by extract(). */
export function resolveExtractSchema<Schema extends StagehandSchema>(
  value: Schema,
): ResolvedExtractSchema<StandardSchemaV1.InferOutput<Schema>>;
export function resolveExtractSchema(value: unknown): ResolvedExtractSchema;
export function resolveExtractSchema(value: unknown): ResolvedExtractSchema {
  const standard = standardProperties(value);
  if (!standard) {
    throw new StagehandSchemaError(
      "Unsupported schema. Stagehand requires a native Standard Schema V1 and Standard JSON Schema V1 implementation.",
    );
  }

  const vendor = typeof standard.vendor === "string" ? standard.vendor : undefined;
  if (standard.version !== 1) {
    throw new StagehandSchemaError("Schema must implement Standard Schema version 1.", { vendor });
  }
  if (!vendor) {
    throw new StagehandSchemaError("Schema must provide a Standard Schema vendor name.");
  }
  if (typeof standard.validate !== "function") {
    throw new StagehandSchemaError(
      "Schema does not provide Standard Schema V1 validation through ~standard.validate().",
      { vendor },
    );
  }
  if (!hasJsonSchemaConverters(standard.jsonSchema)) {
    throw new StagehandSchemaError(
      `Schema does not provide both Standard JSON Schema V1 input and output converters.${converterGuidance(vendor)}`,
      { target: JSON_SCHEMA_TARGET, vendor },
    );
  }

  let jsonSchema: unknown;
  try {
    jsonSchema = standard.jsonSchema.input({ target: JSON_SCHEMA_TARGET });
  } catch (cause) {
    throw new StagehandSchemaError(
      `Schema could not generate the required JSON Schema target "${JSON_SCHEMA_TARGET}".`,
      { cause, target: JSON_SCHEMA_TARGET, vendor },
    );
  }

  let validatedJsonSchema: RawJsonSchema;
  try {
    validatedJsonSchema = validateDynamicJsonSchema(jsonSchema);
  } catch (cause) {
    if (cause instanceof DynamicJsonSchemaError) {
      throw new StagehandSchemaError(cause.message, {
        cause,
        target: JSON_SCHEMA_TARGET,
        vendor,
      });
    }
    throw cause;
  }

  return {
    jsonSchema: validatedJsonSchema,
    validate: standardValidate(value as StandardSchemaV1),
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
  return isObject(standard) ? standard : undefined;
}

function hasJsonSchemaConverters(value: unknown): value is StandardJSONSchemaV1.Converter {
  return isObject(value) && typeof value.input === "function" && typeof value.output === "function";
}

function standardValidate(schema: StandardSchemaV1): (value: unknown) => Promise<unknown> {
  return async (value) => {
    const result = await schema["~standard"].validate(value);
    if (result.issues) throw new StagehandValidationError(result.issues);
    return result.value;
  };
}

function converterGuidance(vendor: string | undefined): string {
  if (vendor === "zod") return " Upgrade to Zod 4.2.0 or newer.";
  if (vendor === "valibot") {
    return " Wrap the Valibot schema with @valibot/to-json-schema's toStandardJsonSchema().";
  }
  return " Upgrade the schema library or use its official Standard JSON Schema adapter.";
}

function isRecordLike(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
