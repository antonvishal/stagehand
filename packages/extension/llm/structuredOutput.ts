import { z } from "zod/v4";
import {
  createDynamicJsonSchemaValidator,
  createDynamicJsonSchemaValidatorFromValidated,
  validateDynamicJsonSchema,
} from "../../protocol/dynamic-json-schema.ts";
import type {
  DynamicJsonSchema,
  DynamicJsonSchemaIssue,
} from "../../protocol/dynamic-json-schema.ts";

export interface StructuredOutputContract<Output = unknown> {
  readonly name: string;
  readonly jsonSchema: DynamicJsonSchema;
  validate(
    value: unknown,
  ): Promise<
    | { readonly success: true; readonly value: Output }
    | { readonly success: false; readonly issues: readonly DynamicJsonSchemaIssue[] }
  >;
}

/** Internal provider-facing validation error; never crosses the public SDK boundary. */
export class StructuredOutputValidationError extends TypeError {
  readonly issues: readonly DynamicJsonSchemaIssue[];

  constructor(issues: readonly DynamicJsonSchemaIssue[]) {
    super(
      issues.map((issue) => issue.message).join("; ") || "Structured output validation failed.",
    );
    this.name = "StructuredOutputValidationError";
    this.issues = issues;
  }
}

/** Converts an extension-owned Zod schema into the canonical contract once. */
export function createZodStructuredOutputContract<Output>(
  name: string,
  schema: z.ZodType<Output>,
): StructuredOutputContract<Output> {
  const jsonSchema = z
    .json()
    .parse(
      z.toJSONSchema(schema, { io: "input", metadata: z.registry(), target: "draft-2020-12" }),
    );
  return {
    name,
    jsonSchema: validateDynamicJsonSchema(jsonSchema),
    validate: async (value) => {
      const result = await schema.safeParseAsync(value);
      return result.success
        ? { success: true, value: result.data }
        : { success: false, issues: result.error.issues };
    },
  };
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
  let contract: ReturnType<typeof createDynamicJsonSchemaValidator>;
  try {
    contract = createDynamicJsonSchemaValidator(schema);
  } catch (cause) {
    throw new TypeError(
      `${provider ? `Provider ${provider}` : `Structured output ${name}`} cannot use the supplied Draft 2020-12 schema: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }

  return {
    name,
    jsonSchema: contract.jsonSchema,
    validate: async (value) => {
      const result = contract.validate(value);
      if (!result.issues) return { success: true, value: result.value };
      return {
        success: false,
        issues: result.issues,
      };
    },
  };
}

/** Builds a contract from a canonical schema already hardened at its trust boundary. */
export function createStructuredOutputContractFromValidated(
  name: string,
  schema: DynamicJsonSchema,
): StructuredOutputContract {
  const contract = createDynamicJsonSchemaValidatorFromValidated(schema);
  return {
    name,
    jsonSchema: contract.jsonSchema,
    validate: async (value) => {
      const result = contract.validate(value);
      return result.issues
        ? { success: false, issues: result.issues }
        : { success: true, value: result.value };
    },
  };
}
