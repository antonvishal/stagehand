import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import type { JSONSchema } from "json-schema-typed";
import {
  createDynamicJsonSchemaValidator,
  DynamicJsonSchemaError,
  validateDynamicJsonSchema,
} from "../../protocol/dynamic-json-schema.ts";
import type { DynamicJsonSchema, JsonValue } from "../../protocol/dynamic-json-schema.ts";

export type { StandardJSONSchemaV1, StandardSchemaV1 };

/** Draft 2020-12 definitions for the properties of a closed object schema. */
export type RawJsonSchema = Readonly<Record<string, JSONSchema>>;
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
  readonly jsonSchema: DynamicJsonSchema;
  validate(value: unknown): Promise<Output>;
}

const JSON_SCHEMA_TARGET = "draft-2020-12" as const;
const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema" as const;
const RAW_SCHEMA_VENDOR = "stagehand-json-schema";

/**
 * Builds a closed Draft 2020-12 object schema from property definitions.
 * Every property is required. The generic supplies a static type; Stagehand cannot infer it.
 */
export function jsonSchema<T = unknown>(properties: RawJsonSchema): StagehandSchema<T, T> {
  let contract;
  try {
    contract = createDynamicJsonSchemaValidator<T>({
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    });
  } catch (cause) {
    throw schemaError(cause, RAW_SCHEMA_VENDOR);
  }

  const convert = (options: StandardJSONSchemaV1.Options): Record<string, unknown> => {
    if (options.target !== JSON_SCHEMA_TARGET) {
      throw new StagehandSchemaError(
        `Raw JSON Schema adapters only support the "${JSON_SCHEMA_TARGET}" target.`,
        { target: options.target, vendor: RAW_SCHEMA_VENDOR },
      );
    }
    return validateDynamicJsonSchema(contract.jsonSchema);
  };

  return {
    "~standard": {
      version: 1,
      vendor: RAW_SCHEMA_VENDOR,
      types: undefined,
      jsonSchema: { input: convert, output: convert },
      validate: (value) => {
        try {
          return contract.validate(value);
        } catch (cause) {
          throw schemaError(cause, RAW_SCHEMA_VENDOR);
        }
      },
    },
  };
}

/** Converts and hardens one side of a Standard JSON Schema V1 implementation. */
export function standardSchemaToJsonSchema(
  schema: StandardJSONSchemaV1,
  io: "input" | "output",
): RawJsonSchema {
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

  try {
    return validateDynamicJsonSchema(converted) as RawJsonSchema;
  } catch (cause) {
    throw schemaError(cause, vendor);
  }
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
): ResolvedExtractSchema<StandardSchemaV1.InferOutput<Schema>>;
export function resolveExtractSchema(value: unknown): ResolvedExtractSchema;
export function resolveExtractSchema(value: unknown): ResolvedExtractSchema {
  const standard = standardProperties(value);
  if (!standard) {
    const guidance = isObject(value) ? " Use jsonSchema() for raw Draft 2020-12 schemas." : "";
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
  if (!hasJsonSchemaConverters(standard.jsonSchema)) {
    throw new StagehandSchemaError(
      `Schema does not provide both Standard JSON Schema V1 input and output converters.${converterGuidance(vendor)}`,
      { target: JSON_SCHEMA_TARGET, vendor },
    );
  }

  const schema = value as StagehandSchema;
  return {
    jsonSchema: standardSchemaToJsonSchema(schema, "input") as DynamicJsonSchema,
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
  return isObject(standard) ? standard : undefined;
}

function hasJsonSchemaConverters(value: unknown): value is StandardJSONSchemaV1.Converter {
  return isObject(value) && typeof value.input === "function" && typeof value.output === "function";
}

function schemaError(cause: unknown, vendor: string): StagehandSchemaError {
  if (cause instanceof StagehandSchemaError) return cause;
  if (cause instanceof DynamicJsonSchemaError) {
    return new StagehandSchemaError(cause.message, {
      cause,
      target: JSON_SCHEMA_TARGET,
      vendor,
    });
  }
  return new StagehandSchemaError("Draft 2020-12 schema validation failed.", {
    cause,
    target: JSON_SCHEMA_TARGET,
    vendor,
  });
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
