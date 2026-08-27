import { describe, expect, it } from "vitest";

import {
  createStructuredOutputContract,
  providerJsonSchema,
  StructuredOutputValidationError,
} from "./structuredOutput.js";

describe("provider JSON Schema isolation", () => {
  it("clones the canonical schema independently for each provider call", () => {
    const canonical = {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    };
    const first = providerJsonSchema(canonical, "openai");
    const second = providerJsonSchema(canonical, "anthropic");

    (first.properties as Record<string, unknown>).name = { type: "number" };

    expect(second).toStrictEqual(canonical);
    expect(canonical.properties.name).toStrictEqual({ type: "string" });
    expect(first).not.toBe(second);
  });

  it("attributes unsupported schemas to the selected provider", () => {
    expect(() =>
      providerJsonSchema(
        {
          type: "object",
          properties: { nested: { $id: "unsafe", type: "string" } },
        },
        "openai",
      ),
    ).toThrow(/Provider openai.*nested identifier scope/);
  });

  it("validates output with a request-local Draft 2020-12 interpreter", async () => {
    const contract = createStructuredOutputContract("inventory", {
      type: "object",
      properties: { quantity: { type: "integer", minimum: 0 } },
      required: ["quantity"],
      additionalProperties: false,
    });

    await expect(contract.validate({ quantity: 2 })).resolves.toMatchObject({ success: true });
    await expect(contract.validate({ quantity: -1 })).resolves.toMatchObject({
      success: false,
      issues: [expect.objectContaining({ path: ["quantity"] })],
    });
  });

  it("rejects unsafe regular expressions, unknown assertions, and custom vocabularies", () => {
    for (const schema of [
      { type: "string", pattern: "(a+)+$" },
      { type: "string", customAssertion: true },
      {
        $vocabulary: { "https://example.com/custom-vocabulary": true },
        type: "string",
      },
    ]) {
      expect(() => createStructuredOutputContract("unsafe", schema)).toThrow();
    }
  });

  it("rejects direct-RPC JavaScript object attacks before interpreter construction", () => {
    const cyclic: Record<string, unknown> = { type: "object" };
    cyclic.properties = cyclic;
    const inherited = Object.create({ type: "string" }) as Record<string, unknown>;
    const sparse = [] as unknown[];
    sparse.length = 2;

    for (const schema of [cyclic, inherited, { anyOf: sparse }]) {
      expect(() => createStructuredOutputContract("direct RPC", schema)).toThrow();
    }

    let invoked = false;
    const accessor = {};
    Object.defineProperty(accessor, "type", {
      enumerable: true,
      get() {
        invoked = true;
        return "string";
      },
    });
    expect(() => createStructuredOutputContract("direct RPC", accessor)).toThrow(/accessors/);
    expect(invoked).toBe(false);
  });

  it("does not expose cfworker error classes through its owned error surface", async () => {
    const contract = createStructuredOutputContract("answer", { type: "string" });
    const result = await contract.validate(42);
    expect(result.success).toBe(false);
    if (result.success) return;

    const error = new StructuredOutputValidationError(result.issues);
    expect(error.name).toBe("StructuredOutputValidationError");
    expect(error.constructor.name).not.toMatch(/Validator|Schema/u);
  });

  it("rejects non-JSON and aliased values before the interpreter reads them", async () => {
    const contract = createStructuredOutputContract("untrusted output", {});
    const shared = { value: 1 };
    const sparse = [] as unknown[];
    sparse.length = 1;

    await expect(contract.validate({ first: shared, second: shared })).rejects.toThrow(
      /shared references/,
    );
    await expect(contract.validate({ value: Number.NaN })).rejects.toThrow(/JSON-safe/);
    await expect(contract.validate(sparse)).rejects.toThrow(/sparse/);
    await expect(contract.validate(new (class Output {})())).rejects.toThrow(/plain/);
  });
});
