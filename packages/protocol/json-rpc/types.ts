import { z } from "zod/v4";
import type {
  JSONRPCEnvelopeSchema,
  JSONRPCErrorObjectSchema,
  JSONRPCErrorResponseSchema,
  JSONRPCMessageSchema,
  JSONRPCNotificationSchema,
  JSONRPCRequestIdSchema,
  JSONRPCRequestSchema,
  JSONRPCResponseSchema,
  JSONRPCSuccessResponseSchema,
  JSONRPCWireInputSchema,
} from "./schemas.js";

export type JSONRPCEnvelope = z.output<typeof JSONRPCEnvelopeSchema>;
export type JSONRPCErrorObject = z.output<typeof JSONRPCErrorObjectSchema>;
export type JSONRPCRequestId = z.output<typeof JSONRPCRequestIdSchema>;
export type JSONRPCRequest = z.output<typeof JSONRPCRequestSchema>;
export type JSONRPCNotification = z.output<typeof JSONRPCNotificationSchema>;
export type JSONRPCSuccessResponse = z.output<typeof JSONRPCSuccessResponseSchema>;
export type JSONRPCErrorResponse = z.output<typeof JSONRPCErrorResponseSchema>;
export type JSONRPCResponse = z.output<typeof JSONRPCResponseSchema>;
export type JSONRPCMessage = z.output<typeof JSONRPCMessageSchema>;
export type JSONRPCWireInput = z.output<typeof JSONRPCWireInputSchema>;
