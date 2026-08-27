import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Validator } from "@cfworker/json-schema";
import type { Schema } from "@cfworker/json-schema";
import {
  assertDynamicValidationWork,
  validateDynamicJsonSchema,
} from "../../protocol/dynamic-json-schema.ts";
import type { DynamicJsonSchema } from "../../protocol/dynamic-json-schema.ts";

export interface StructuredOutputContract<Output = unknown> {
  readonly name: string;
  readonly jsonSchema: DynamicJsonSchema;
  validate(
    value: unknown,
  ): Promise<
    | { readonly success: true; readonly value: Output }
    | { readonly success: false; readonly issues: readonly StandardSchemaV1.Issue[] }
  >;
}

/** Internal provider-facing validation error; never crosses the public SDK boundary. */
export class StructuredOutputValidationError extends TypeError {
  readonly issues: readonly StandardSchemaV1.Issue[];

  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super(
      issues.map((issue) => issue.message).join("; ") || "Structured output validation failed.",
    );
    this.name = "StructuredOutputValidationError";
    this.issues = issues;
  }
}

/** Creates the isolated canonical clone handed to one provider invocation. */
export function providerJsonSchema(
  schema: Record<string, unknown>,
  provider: string | undefined,
): Record<string, unknown> {
  try {
    return validateDynamicJsonSchema(schema);
  } catch (cause) {
    throw new TypeError(
      `${provider ? `Provider ${provider}` : "The selected provider"} cannot use the supplied Draft 2020-12 schema: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }
}

/** Builds one request-scoped, CSP-safe Draft 2020-12 validation contract. */
export function createStructuredOutputContract(
  name: string,
  schema: Record<string, unknown>,
  provider?: string,
): StructuredOutputContract {
  const jsonSchema = providerJsonSchema(schema, provider) as DynamicJsonSchema;
  let validator: Validator;
  try {
    validator = new Validator(jsonSchema as Schema, "2020-12", true);
  } catch (cause) {
    throw new TypeError(`Invalid Draft 2020-12 schema for ${name}.`, { cause });
  }

  return {
    name,
    jsonSchema,
    validate: async (value) => {
      assertDynamicValidationWork(jsonSchema as DynamicJsonSchema, value);
      let result: ReturnType<Validator["validate"]>;
      try {
        result = validator.validate(value);
      } catch (cause) {
        throw new TypeError(`Draft 2020-12 validation failed for ${name}.`, { cause });
      }
      if (result.valid) return { success: true, value };
      return {
        success: false,
        issues: result.errors.map((error) => ({
          message: error.error,
          path: jsonPointerPath(error.instanceLocation),
        })),
      };
    },
  };
}

function jsonPointerPath(pointer: string): PropertyKey[] | undefined {
  if (pointer === "" || pointer === "#") return undefined;
  const normalized = pointer.startsWith("#") ? pointer.slice(1) : pointer;
  if (!normalized.startsWith("/")) return undefined;
  return normalized
    .slice(1)
    .split("/")
    .map((segment) =>
      safeDecodePointerSegment(segment).replaceAll("~1", "/").replaceAll("~0", "~"),
    );
}

function safeDecodePointerSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
