import type { RPCMethod } from "../../protocol/json-rpc/schemas.js";
import type { StagehandRpcNotification } from "../../protocol/types.js";
import { z } from "zod/v4";

/** The transport-independent command boundary used by Stagehand's public object model. */
export interface StagehandCommandClient {
  send<Method extends RPCMethod>(
    method: Method,
    params: z.input<Method["params"]>,
  ): Promise<z.output<Method["result"]>>;
  onNotification(listener: (notification: StagehandRpcNotification) => void): () => void;
}
