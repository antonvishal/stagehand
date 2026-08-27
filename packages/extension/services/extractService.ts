import { z } from "zod/v4";
import { validateDynamicJsonSchema } from "../../protocol/dynamic-json-schema.ts";
import type {
  ClientModelReference,
  ExtractResult,
  LLMImageContent,
  ModelConfig,
  StagehandExtractParams,
} from "../../protocol/types.js";
import { TimeoutError } from "../errors.js";
import * as inference from "../inference.js";
import type { ClientLlmRequest } from "../llm/clientLlmClient.js";
import type { GatewayContext } from "../llm/gatewayClient.js";
import {
  createStructuredOutputContract,
  StructuredOutputValidationError,
} from "../llm/structuredOutput.js";
import type { StagehandLogger } from "../logger.js";
import { bytesToBase64 } from "../understudy/fileUploadUtils.js";
import type { Page } from "../understudy/page.js";
import type { EncodedId, SchemaPathSegments } from "../types/private/internal.js";
import { injectUrls, transformJsonSchemaUrls } from "../utils.js";
import { createTimeoutGuard } from "../handlers/handlerUtils/timeoutGuard.js";
import * as cacheService from "./cacheService.js";
import * as llmService from "./llmService.js";
import { disabledCacheMetadata, zeroStagehandResultUsage } from "./resultUsage.js";

/** Replaces URL strings with DOM IDs until extraction has resolved the page's URL map. */
export function transformUrlStringsToNumericIds(
  schema: Record<string, unknown>,
): [Record<string, unknown>, SchemaPathSegments[]] {
  return transformJsonSchemaUrls(schema);
}

interface ExtractionResponse extends Record<string, unknown> {
  metadata: { completed: boolean };
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  cached_input_tokens: number;
  inference_time_ms: number;
}

export async function extract({
  params,
  page,
  model,
  clientLLMGenerate,
  logger,
  systemPrompt = "",
  cache,
  gateway,
}: {
  params: StagehandExtractParams;
  page: Pick<Page, "captureSnapshot" | "screenshot">;
  model: ModelConfig | ClientModelReference | undefined;
  clientLLMGenerate: ClientLlmRequest;
  logger: StagehandLogger;
  systemPrompt?: string;
  cache?: cacheService.CacheContext;
  gateway?: GatewayContext;
}): Promise<ExtractResult> {
  const { instruction, options } = params;
  const ensureTimeRemaining = createTimeoutGuard(
    options?.timeout,
    (ms) => new TimeoutError("extract()", ms),
  );

  // Cache keys contain DOM state, not screenshot pixels. Do not serve a
  // visual extraction from a cache entry that cannot represent its image.
  if (options?.screenshot) {
    return (await runExtraction()).result;
  }

  return await cacheService.withCache<ExtractResult>({
    method: "extract",
    page,
    data: cacheService.buildExtractCacheData(params),
    caching: options?.cache,
    bypass: cacheService.shouldBypassCacheForLocatorScope(options),
    context: cache,
    logger,
    onHit: (value) => ({
      data: z.json().parse(value),
      metadata: { usage: zeroStagehandResultUsage(), cache: disabledCacheMetadata() },
    }),
    execute: () => runExtraction(),
  });

  async function runExtraction(): Promise<cacheService.CacheExecuteOutcome<ExtractResult>> {
    ensureTimeRemaining();
    const { combinedTree, combinedUrlMap } = await page.captureSnapshot({
      focusLocator: options?.locator,
      ignoreLocators: options?.ignoreLocators,
    });
    ensureTimeRemaining();

    const screenshot = options?.screenshot
      ? await (async () => {
          ensureTimeRemaining();
          const image = await page.screenshot({ fullPage: false, type: "png" });
          ensureTimeRemaining();
          return image;
        })()
      : undefined;

    logger.info(
      screenshot
        ? "Starting extraction using an accessibility snapshot and viewport screenshot"
        : "Starting extraction using an accessibility snapshot",
      { category: "extraction", instruction },
    );

    const schema = validateDynamicJsonSchema(params.schema);
    const finalOutputSchema = createStructuredOutputContract("ExtractionResult", schema);
    const isObjectSchema = schema.type === "object" || isRecord(schema.properties);
    const wrapKey = "value" as const;
    const [transformedJsonSchema, urlFieldPaths] = transformUrlStringsToNumericIds(
      isObjectSchema ? schema : wrapRootSchema(schema, wrapKey),
    );
    const transformedSchema = createStructuredOutputContract(
      "TransformedExtraction",
      transformedJsonSchema,
    );
    const screenshotContent: LLMImageContent | undefined = screenshot
      ? { type: "image", data: bytesToBase64(screenshot), mimeType: "image/png" }
      : undefined;

    ensureTimeRemaining();
    const extractionResponse = (await inference.extract({
      instruction,
      domElements: combinedTree,
      schema: transformedSchema,
      generate: (input) => llmService.generate(model, input, clientLLMGenerate, gateway),
      userProvidedInstructions: systemPrompt,
      screenshot: screenshotContent,
    })) as ExtractionResponse;
    ensureTimeRemaining();

    const {
      metadata: { completed },
      prompt_tokens,
      completion_tokens,
      reasoning_tokens,
      cached_input_tokens,
      inference_time_ms,
      ...rest
    } = extractionResponse;
    let output: unknown = rest;
    const idToUrl = (combinedUrlMap ?? {}) as Record<EncodedId, string>;
    for (const { segments } of urlFieldPaths) {
      injectUrls(output, segments, idToUrl as Record<string, string>);
    }
    if (!isObjectSchema && isRecord(output)) output = output[wrapKey];

    logger.info(
      completed
        ? "Extraction completed successfully"
        : "Extraction incomplete after processing all data",
      {
        category: "extraction",
        promptTokens: prompt_tokens,
        completionTokens: completion_tokens,
        inferenceTimeMs: inference_time_ms,
      },
    );

    const validation = await finalOutputSchema.validate(output);
    if (!validation.success) throw new StructuredOutputValidationError(validation.issues);
    const data = z.json().parse(validation.value);
    return {
      result: {
        data,
        metadata: {
          usage: {
            inputTokens: prompt_tokens,
            outputTokens: completion_tokens,
            reasoningTokens: reasoning_tokens,
            cachedInputTokens: cached_input_tokens,
            inferenceTimeMs: inference_time_ms,
          },
          cache: disabledCacheMetadata(),
        },
      },
      cacheValue: data,
      llmUsage: {
        inputTokens: prompt_tokens,
        outputTokens: completion_tokens,
        llmDurationMs: inference_time_ms,
      },
    };
  }
}

export function wrapRootSchema(
  schema: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  for (const keyword of ["$id", "$anchor", "$dynamicAnchor"] as const) {
    if (schema[keyword] !== undefined) {
      throw new TypeError(
        `Cannot wrap a non-object JSON Schema containing ${keyword}; relocation would change its reference scope.`,
      );
    }
  }
  const { $schema, $defs, ...body } = schema;
  return {
    ...($schema === undefined ? {} : { $schema }),
    ...($defs === undefined ? {} : { $defs }),
    type: "object",
    properties: { [key]: body },
    required: [key],
    additionalProperties: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
