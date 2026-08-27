import { writeFile } from "node:fs/promises";
import { z } from "zod/v4";
import { PROTOCOL_DEFINITION_ORDER } from "../protocol-definition-order.ts";
import { StagehandMethods, StagehandNotifications } from "../schema-registry.ts";
import { BrowserbaseSessionCreateParamsSchema } from "../schemas.ts";
import {
  JSONRPCErrorResponseSchema,
  JSONRPCNotificationSchema,
  JSONRPCRequestSchema,
  JSONRPCSuccessResponseSchema,
} from "./schemas.ts";
import { toWireJsonSchema } from "./wire-casing.ts";

const PROTOCOL_DOCUMENT_ID = "stagehand.v4" as const;

const methodEntries = Object.values(StagehandMethods);
const notificationEntries = Object.values(StagehandNotifications);

const notificationEnvelopeSchemas = notificationEntries.map((notification) =>
  JSONRPCNotificationSchema.extend({
    method: z.literal(notification.name),
    params: notification.params,
  }),
);
const requestEnvelopeSchemas = methodEntries.map((method) =>
  JSONRPCRequestSchema.extend({
    method: z.literal(method.name),
    params: method.params,
  }),
);

const StagehandProtocolDocumentSchema = z
  .strictObject({
    methods: z.strictObject(
      Object.fromEntries(
        methodEntries.map((method) => [
          method.name,
          z.strictObject({ params: method.params, result: method.result }),
        ]),
      ),
    ),
    notifications: z.strictObject(
      Object.fromEntries(
        notificationEntries.map((notification) => [
          notification.name,
          z.strictObject({ params: notification.params }),
        ]),
      ),
    ),
    legacyClientModels: z
      .strictObject({
        browserbaseSessionCreateParams: BrowserbaseSessionCreateParamsSchema,
      })
      .optional(),
    jsonrpc: z.strictObject({
      request: z
        .union([requestEnvelopeSchemas[0]!, ...requestEnvelopeSchemas.slice(1)])
        .meta({ id: "StagehandRpcRequest" }),
      notification: (notificationEnvelopeSchemas.length === 1
        ? notificationEnvelopeSchemas[0]!
        : z.union([notificationEnvelopeSchemas[0]!, ...notificationEnvelopeSchemas.slice(1)])
      ).meta({ id: "StagehandRpcNotification" }),
      successResponse: JSONRPCSuccessResponseSchema,
      errorResponse: JSONRPCErrorResponseSchema,
    }),
  })
  .meta({ id: "StagehandProtocolDocument", title: "Stagehand V4 Protocol" });

function buildStagehandProtocolDocument(): Record<string, unknown> {
  const preservedDocumentPropertyNames = new Set([
    "methods",
    "notifications",
    "jsonrpc",
    "request",
    "notification",
    "successResponse",
    "errorResponse",
    "params",
    "result",
    ...methodEntries.map((method) => method.name),
    ...notificationEntries.map((notification) => notification.name),
  ]);
  const generated = toWireJsonSchema(
    z.toJSONSchema(StagehandProtocolDocumentSchema, {
      io: "input",
      target: "draft-2020-12",
    }),
    preservedDocumentPropertyNames,
  ) as Record<string, unknown>;
  const { $schema, ...document } = generated;
  const definitions = document.$defs as Record<string, unknown> | undefined;
  if (definitions === undefined) throw new TypeError("Protocol schema must contain $defs");
  const canonicalDefinitions = canonicalizeAnonymousDefinitions(definitions, document);
  const actualIds = Object.keys(canonicalDefinitions);
  const expectedIds = new Set<string>(PROTOCOL_DEFINITION_ORDER);
  const missing = PROTOCOL_DEFINITION_ORDER.filter((id) => !(id in canonicalDefinitions));
  const extra = actualIds.filter((id) => !expectedIds.has(id));
  if (missing.length > 0 || extra.length > 0) {
    throw new TypeError(
      `Protocol definition mismatch (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
    );
  }
  return {
    $schema,
    $id: `https://stagehand.dev/schema/${PROTOCOL_DOCUMENT_ID}.json`,
    ...document,
    $defs: Object.fromEntries(
      PROTOCOL_DEFINITION_ORDER.map((id) => [id, canonicalDefinitions[id]]),
    ),
  };
}

function canonicalizeAnonymousDefinitions(
  definitions: Record<string, unknown>,
  document: Record<string, unknown>,
): Record<string, unknown> {
  const actual = Object.keys(definitions).filter((id) => /^__schema\d+$/.test(id));
  const expected = PROTOCOL_DEFINITION_ORDER.filter((id) => /^__schema\d+$/.test(id));
  if (actual.length !== expected.length) {
    throw new TypeError(`Expected ${expected.length} anonymous schemas, received ${actual.length}`);
  }
  const names = new Map(actual.map((id, index) => [id, expected[index]!]));
  const renameReferences = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(renameReferences);
    if (typeof value !== "object" || value === null) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (key === "$ref" && typeof entry === "string") {
          const id = entry.match(/^#\/\$defs\/(.+)$/)?.[1];
          return [key, id === undefined ? entry : `#/$defs/${names.get(id) ?? id}`];
        }
        return [key, renameReferences(entry)];
      }),
    );
  };
  const renamed = Object.fromEntries(
    Object.entries(definitions).map(([id, schema]) => [
      names.get(id) ?? id,
      renameReferences(schema),
    ]),
  );
  Object.assign(document, renameReferences(document));
  return renamed;
}

await writeFile(
  new URL(`../${PROTOCOL_DOCUMENT_ID}.json`, import.meta.url),
  `${JSON.stringify(buildStagehandProtocolDocument(), null, 2)}\n`,
  "utf8",
);
