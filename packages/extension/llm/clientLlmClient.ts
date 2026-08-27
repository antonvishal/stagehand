import {
  createLLMGenerateResultSchema,
  LLMGenerateParamsSchema,
  LLMGenerateResultSchema,
} from "../../protocol/schemas.js";
import type { LLMGenerateParams, LLMGenerateResult } from "../../protocol/types.js";
import {
  createStructuredOutputContract,
  StructuredOutputValidationError,
} from "./structuredOutput.js";

export type ClientLlmRequest = (params: LLMGenerateParams) => Promise<LLMGenerateResult>;

/** Sends a Stagehand LLM request to the connected SDK and awaits its response. */
export async function generateWithClientLlm(
  request: ClientLlmRequest,
  input: LLMGenerateParams,
): Promise<LLMGenerateResult> {
  const params = LLMGenerateParamsSchema.parse(input);
  const candidate: unknown = await request(params);
  const validatedResult = createLLMGenerateResultSchema(params).parse(candidate);
  if (
    params.responseFormat?.type === "json_schema" &&
    validatedResult.outputFormat === "json_schema"
  ) {
    const contract = createStructuredOutputContract(
      params.responseFormat.name,
      params.responseFormat.schema as Record<string, unknown>,
      "client LLM",
    );
    const validation = await contract.validate(validatedResult.structuredContent);
    if (!validation.success) throw new StructuredOutputValidationError(validation.issues);
  }
  return LLMGenerateResultSchema.parse(validatedResult);
}
