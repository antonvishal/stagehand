/**
 * TypeScript SDK-owned schemas. They extend protocol schemas with SDK-only values such as local/CDP
 * connection options, JavaScript callbacks, and Page instances. Those values are consumed by the
 * SDK and never cross the RPC boundary. Other language SDKs should follow the same pattern around
 * the shared wire params.
 */

import { z } from "zod/v4";
import type Browserbase from "@browserbasehq/sdk";
import * as ProtocolSchemas from "../../protocol/schemas.js";
import type { StagehandLog } from "../../protocol/types.js";
import {
  ActOptionsSchema,
  BrowserbaseRegionSchema,
  ExtractOptionsSchema,
  LLMGenerateParamsSchema,
  LLMGenerateResultSchema,
  ModelConfigSchema,
  ObserveOptionsSchema,
  StagehandInitParamsSchema,
  StagehandLogSchema,
  StagehandLogLevelSchema,
} from "../../protocol/schemas.js";
import { Page } from "./page.js";
import { Locator } from "./locator.js";
import { isStagehandBrowser, type StagehandBrowser } from "./browser/index.js";

const LocalBrowserLaunchOptionsRuntimeSchema = z
  .strictObject({
    args: z.array(z.string()).optional(),
    executablePath: z.string().optional(),
    port: z.number().optional(),
    userDataDir: z.string().optional(),
    preserveUserDataDir: z.boolean().optional(),
    headless: z.boolean().optional(),
    devtools: z.boolean().optional(),
    chromiumSandbox: z.boolean().optional(),
    ignoreDefaultArgs: z.union([z.boolean(), z.array(z.string())]).optional(),
    proxy: z
      .strictObject({
        server: z.string(),
        bypass: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
      })
      .optional(),
    locale: z.string().optional(),
    viewport: z.strictObject({ width: z.number(), height: z.number() }).optional(),
    deviceScaleFactor: z.number().optional(),
    hasTouch: z.boolean().optional(),
    ignoreHTTPSErrors: z.boolean().optional(),
    downloadsPath: z.string().optional(),
    acceptDownloads: z.boolean().optional(),
    keepAlive: z.boolean().optional(),
  })
  .meta({ id: "LocalBrowserLaunchOptions" });

const LocalBrowserConnectOptionsRuntimeSchema = z
  .strictObject({
    cdpUrl: z.string().min(1),
    extensionId: z.string().min(1).optional(),
  })
  .meta({ id: "LocalBrowserConnectOptions" });

export const DEFAULT_BROWSERBASE_URL = "https://api.browserbase.com";

type BrowserbaseLaunchOptionsInput = Browserbase.SessionCreateParams & {
  apiKey: string;
  baseUrl?: string;
};

type BrowserbaseLaunchOptionsOutput = Browserbase.SessionCreateParams & {
  apiKey: string;
  baseUrl: string;
};

/**
 * Browserbase owns the session option surface. Keep this object loose so newly added SDK options
 * pass through without requiring a Stagehand protocol or schema update.
 */
const BrowserbaseLaunchOptionsObjectSchema = z
  .looseObject({
    apiKey: z.string().min(1),
    baseUrl: z.url().default(DEFAULT_BROWSERBASE_URL),
    apiUrl: z.never().optional(),
    type: z.never().optional(),
  })
  .meta({ id: "BrowserbaseLaunchOptions" });

const BrowserbaseLaunchOptionsRuntimeSchema =
  BrowserbaseLaunchOptionsObjectSchema as typeof BrowserbaseLaunchOptionsObjectSchema &
    z.ZodType<BrowserbaseLaunchOptionsOutput, BrowserbaseLaunchOptionsInput>;

const BrowserbaseConnectOptionsRuntimeSchema = z
  .strictObject({
    apiKey: z.string().min(1),
    baseUrl: z.url().default(DEFAULT_BROWSERBASE_URL),
    sessionId: z.string().min(1),
    extensionId: z.string().min(1).optional(),
  })
  .meta({ id: "BrowserbaseConnectOptions" });

/** Data returned by the Browserbase SDK after creating a session. */
export const BrowserbaseSessionCreateResultSchema = z
  .object({
    id: z.string(),
    connectUrl: z.string(),
  })
  .meta({ id: "BrowserbaseSessionCreateResult" });

/** Data returned by the Browserbase SDK when retrieving a session. */
export const BrowserbaseSessionRetrieveResultSchema = z
  .object({
    id: z.string(),
    connectUrl: z.string().optional(),
    region: BrowserbaseRegionSchema.optional(),
  })
  .meta({ id: "BrowserbaseSessionRetrieveResult" });

/** Normalized connection data shared by Browserbase launch and connect flows. */
export const BrowserbaseSessionConnectionSchema = z
  .strictObject({
    sessionId: z.string().trim().min(1),
    cdpUrl: z.string().trim().min(1),
    region: BrowserbaseRegionSchema.optional(),
  })
  .meta({ id: "BrowserbaseSessionConnection" });

const WebMCPToolsOptionsRuntimeSchema = ProtocolSchemas.WebMCPToolsOptionsSchema.partial();

const WebMCPInvokeOptionsRuntimeSchema = ProtocolSchemas.WebMCPInvokeOptionsSchema.partial();

const WebMCPResultOptionsRuntimeSchema = ProtocolSchemas.WebMCPResultOptionsSchema;

/** An LLM callback implemented locally by the SDK consumer. It never crosses the wire. */
const ClientLLMRuntimeSchema = z
  .strictObject({
    generate: z.function({
      input: [LLMGenerateParamsSchema],
      output: z.promise(LLMGenerateResultSchema),
    }),
  })
  .meta({ id: "ClientLLM" });

const StagehandClientLogLevelRuntimeSchema = z
  .union([StagehandLogLevelSchema, z.literal("off")])
  .meta({ id: "StagehandClientLogLevel" });

const StagehandClientLogFormatRuntimeSchema = z
  .enum(["pretty", "json"])
  .meta({ id: "StagehandClientLogFormat" });

const StagehandClientOnLogFunctionSchema = z
  .function({
    input: [StagehandLogSchema],
    // Callback failures are observed by Stagehand after invocation. `any`
    // permits either a synchronous return or a promise without Zod trying to
    // synchronously parse the promise itself.
    output: z.any(),
  })
  .meta({ id: "StagehandClientOnLog" });

export const StagehandClientOnLogSchema =
  StagehandClientOnLogFunctionSchema as typeof StagehandClientOnLogFunctionSchema &
    z.ZodType<(log: StagehandLog) => void | Promise<void>>;

const StagehandClientLoggingConfigRuntimeSchema = z
  .strictObject({
    level: StagehandClientLogLevelRuntimeSchema.default("info"),
    format: StagehandClientLogFormatRuntimeSchema.default("pretty"),
    onLog: StagehandClientOnLogSchema.optional(),
  })
  .meta({ id: "StagehandClientLoggingConfig" });

export const StagehandClientActOptionsSchema = ActOptionsSchema.extend({
  locator: z.instanceof(Locator).optional(),
  ignoreLocators: z.array(z.instanceof(Locator)).optional(),
  page: z.instanceof(Page).optional(),
}).meta({ id: "StagehandClientActOptions" });

export const StagehandClientObserveOptionsSchema = ObserveOptionsSchema.extend({
  locator: z.instanceof(Locator).optional(),
  ignoreLocators: z.array(z.instanceof(Locator)).optional(),
  page: z.instanceof(Page).optional(),
}).meta({ id: "StagehandClientObserveOptions" });

export const StagehandClientExtractOptionsSchema = ExtractOptionsSchema.extend({
  locator: z.instanceof(Locator).optional(),
  ignoreLocators: z.array(z.instanceof(Locator)).optional(),
  page: z.instanceof(Page).optional(),
}).meta({ id: "StagehandClientExtractOptions" });

const StagehandClientCreateConfigRuntimeSchema = StagehandInitParamsSchema.omit({
  protocolVersion: true,
  clientInfo: true,
  browserCdpUrl: true,
  logLevel: true,
  browser: true,
})
  .extend({
    model: z.union([ModelConfigSchema, ClientLLMRuntimeSchema]).optional(),
    logging: StagehandClientLoggingConfigRuntimeSchema.default({
      level: "info",
      format: "pretty",
    }),
  })
  .strict()
  .meta({ id: "StagehandClientCreateConfig" });

const StagehandBrowserRuntimeSchema = z
  .custom<StagehandBrowser>(
    isStagehandBrowser,
    "browser must be created by localBrowser or browserbase",
  )
  .meta({ id: "StagehandBrowser" });

const StagehandCreateOptionsRuntimeSchema = StagehandClientCreateConfigRuntimeSchema.extend({
  browser: StagehandBrowserRuntimeSchema,
}).meta({ id: "StagehandCreateOptions" });

export type ClientLLM = z.output<typeof ClientLLMRuntimeSchema>;
export type StagehandClientLoggingConfig = z.input<
  typeof StagehandClientLoggingConfigRuntimeSchema
>;
export type ResolvedStagehandClientLoggingConfig = z.output<
  typeof StagehandClientLoggingConfigRuntimeSchema
>;
export type StagehandClientActOptions = z.input<typeof StagehandClientActOptionsSchema>;
export type StagehandClientObserveOptions = z.input<typeof StagehandClientObserveOptionsSchema>;
export type StagehandClientExtractOptions = z.input<typeof StagehandClientExtractOptionsSchema>;
export type LocalBrowserLaunchOptions = z.output<typeof LocalBrowserLaunchOptionsRuntimeSchema>;
export type LocalBrowserConnectOptions = z.output<typeof LocalBrowserConnectOptionsRuntimeSchema>;
export type BrowserbaseLaunchOptions = BrowserbaseLaunchOptionsInput;
export type BrowserbaseConnectOptions = z.input<typeof BrowserbaseConnectOptionsRuntimeSchema>;
export type BrowserbaseSessionCreateResult = z.output<typeof BrowserbaseSessionCreateResultSchema>;
export type BrowserbaseSessionRetrieveResult = z.output<
  typeof BrowserbaseSessionRetrieveResultSchema
>;
export type BrowserbaseSessionConnection = z.output<typeof BrowserbaseSessionConnectionSchema>;
export type StagehandClientCreateConfig = z.input<typeof StagehandClientCreateConfigRuntimeSchema>;
export type ResolvedStagehandClientCreateConfig = z.output<
  typeof StagehandClientCreateConfigRuntimeSchema
>;
export type StagehandCreateOptions = z.input<typeof StagehandCreateOptionsRuntimeSchema>;
export type ResolvedStagehandCreateOptions = z.output<typeof StagehandCreateOptionsRuntimeSchema>;
export type WebMCPToolsOptions = z.output<typeof WebMCPToolsOptionsRuntimeSchema>;
export type WebMCPInvokeOptions = z.output<typeof WebMCPInvokeOptionsRuntimeSchema>;
export type WebMCPResultOptions = z.output<typeof WebMCPResultOptionsRuntimeSchema>;

/** Internal structural metadata used by cross-language parity tests; not exported by the SDK. */
export const clientSchemaInternals = {
  BrowserbaseConnectOptionsSchema: BrowserbaseConnectOptionsRuntimeSchema,
  BrowserbaseLaunchOptionsSchema: BrowserbaseLaunchOptionsRuntimeSchema,
  ClientLLMSchema: ClientLLMRuntimeSchema,
  LocalBrowserConnectOptionsSchema: LocalBrowserConnectOptionsRuntimeSchema,
  LocalBrowserLaunchOptionsSchema: LocalBrowserLaunchOptionsRuntimeSchema,
  StagehandBrowserSchema: StagehandBrowserRuntimeSchema,
  StagehandClientCreateConfigSchema: StagehandClientCreateConfigRuntimeSchema,
  StagehandClientLogFormatSchema: StagehandClientLogFormatRuntimeSchema,
  StagehandClientLoggingConfigSchema: StagehandClientLoggingConfigRuntimeSchema,
  StagehandClientLogLevelSchema: StagehandClientLogLevelRuntimeSchema,
  StagehandCreateOptionsSchema: StagehandCreateOptionsRuntimeSchema,
  WebMCPInvokeOptionsSchema: WebMCPInvokeOptionsRuntimeSchema,
  WebMCPResultOptionsSchema: WebMCPResultOptionsRuntimeSchema,
  WebMCPToolsOptionsSchema: WebMCPToolsOptionsRuntimeSchema,
} as const;

export const LocalBrowserLaunchOptionsSchema = LocalBrowserLaunchOptionsRuntimeSchema;
export const LocalBrowserConnectOptionsSchema = LocalBrowserConnectOptionsRuntimeSchema;
export const BrowserbaseLaunchOptionsSchema = BrowserbaseLaunchOptionsRuntimeSchema;
export const BrowserbaseConnectOptionsSchema = BrowserbaseConnectOptionsRuntimeSchema;
export const WebMCPToolsOptionsSchema = WebMCPToolsOptionsRuntimeSchema;
export const WebMCPInvokeOptionsSchema = WebMCPInvokeOptionsRuntimeSchema;
export const WebMCPResultOptionsSchema = WebMCPResultOptionsRuntimeSchema;
export const ClientLLMSchema = ClientLLMRuntimeSchema;
export const StagehandClientLogLevelSchema = StagehandClientLogLevelRuntimeSchema;
export const StagehandClientLogFormatSchema = StagehandClientLogFormatRuntimeSchema;
export const StagehandClientLoggingConfigSchema = StagehandClientLoggingConfigRuntimeSchema;
export const StagehandClientCreateConfigSchema = StagehandClientCreateConfigRuntimeSchema;
export const StagehandBrowserSchema = StagehandBrowserRuntimeSchema;
export const StagehandCreateOptionsSchema = StagehandCreateOptionsRuntimeSchema;
