import { describe, expect, it } from "vitest";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import * as valibotJsonSchema15 from "@valibot/to-json-schema15";
import * as arktype from "arktype";
import * as arktype2128 from "arktype2128";
import * as valibot from "valibot";
import * as valibot12 from "valibot12";
import * as zod3 from "zod3";
import * as zod41 from "zod41/v4";

import {
  StagehandSchemaError,
  StagehandValidationError,
  type StagehandSchema,
} from "../src/index.js";
import { z } from "zod/v4";
import {
  assertDynamicValidationWork,
  validateDynamicJsonSchema,
} from "../../protocol/dynamic-json-schema.ts";
import { isExtractSchemaIntent, resolveExtractSchema } from "../src/schema.js";

describe("extract schema boundary", () => {
  it("generates the model schema from the validator input", async () => {
    const schema = z.object({
      length: z.string().transform((value) => value.length),
      page: z.number().default(1),
    });

    const resolved = resolveExtractSchema(schema);

    expect(resolved.jsonSchema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      properties: {
        length: { type: "string" },
        page: { default: 1, type: "number" },
      },
      required: ["length"],
    });
    await expect(resolved.validate({ length: "hello" })).resolves.toEqual({
      length: 5,
      page: 1,
    });
  });

  it("awaits async Standard Schema validators", async () => {
    const schema = dualStandardSchema<string, number>({
      validate: async (value) =>
        typeof value === "string"
          ? { value: value.length }
          : { issues: [{ message: "Expected a string" }] },
      input: { type: "string" },
      output: { type: "number" },
    });

    const resolved = resolveExtractSchema(schema);
    await expect(resolved.validate("hello")).resolves.toBe(5);
  });

  it("recognizes callable dual-standard schemas", () => {
    const schema = Object.assign(
      () => undefined,
      dualStandardSchema({
        validate: (value) => ({ value }),
        input: { type: "string" },
        output: { type: "string" },
      }),
    );

    expect(isExtractSchemaIntent(schema)).toBe(true);
    expect(resolveExtractSchema(schema).jsonSchema).toEqual({ type: "string" });
  });

  it("accepts ArkType through its native standard capabilities", async () => {
    const schema = arktype.type({ name: "string", "quantity?": "number >= 0" });
    const resolved = resolveExtractSchema(schema);

    expect(resolved.jsonSchema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      required: ["name"],
    });
    await expect(resolved.validate({ name: "widget", quantity: 2 })).resolves.toEqual({
      name: "widget",
      quantity: 2,
    });
  });

  it("supports the documented Zod and ArkType minimum versions", async () => {
    const zod42 = await import("zod42/v4");
    const zodSchema = zod42.z.object({ name: zod42.z.string() });
    const arkSchema = arktype2128.type({ name: "string", "quantity?": "number >= 0" });

    await expect(resolveExtractSchema(zodSchema).validate({ name: "widget" })).resolves.toEqual({
      name: "widget",
    });
    await expect(
      resolveExtractSchema(arkSchema).validate({ name: "widget", quantity: 2 }),
    ).resolves.toEqual({ name: "widget", quantity: 2 });
  });

  it("accepts Valibot through its official Standard JSON Schema adapter", async () => {
    const schema = toStandardJsonSchema(
      valibot.object({
        name: valibot.string(),
        quantity: valibot.optional(valibot.number(), 1),
      }),
    );
    const resolved = resolveExtractSchema(schema);

    expect(resolved.jsonSchema).toMatchObject({
      type: "object",
      required: ["name"],
    });
    await expect(resolved.validate({ name: "widget" })).resolves.toEqual({
      name: "widget",
      quantity: 1,
    });
  });

  it("supports the documented Valibot and adapter minimum versions", async () => {
    const schema = valibotJsonSchema15.toStandardJsonSchema(
      valibot12.object({
        name: valibot12.string(),
        quantity: valibot12.optional(valibot12.number(), 1),
      }),
    );

    await expect(resolveExtractSchema(schema).validate({ name: "widget" })).resolves.toEqual({
      name: "widget",
      quantity: 1,
    });
  });

  it("runs Zod coercions, refinements, and async refinements after RPC", async () => {
    const schema = z.object({
      count: z.coerce.number().int().positive(),
      slug: z
        .string()
        .refine((value) => value.includes("-"), "Expected a slug")
        .refine(async (value) => value !== "blocked-slug", "Slug is blocked"),
    });
    const resolved = resolveExtractSchema(schema);

    await expect(resolved.validate({ count: "2", slug: "good-slug" })).resolves.toEqual({
      count: 2,
      slug: "good-slug",
    });
    await expect(resolved.validate({ count: "2", slug: "blocked-slug" })).rejects.toBeInstanceOf(
      StagehandValidationError,
    );
  });

  it("preserves Standard Schema issues on validation errors", async () => {
    const resolved = resolveExtractSchema(z.object({ price: z.number() }));

    try {
      await resolved.validate({ price: "free" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(StagehandValidationError);
      expect((error as StagehandValidationError).issues[0]).toMatchObject({
        message: expect.any(String),
        path: ["price"],
      });
    }
  });

  it("preserves structured Standard Schema issue path segments", async () => {
    const issue = {
      message: "Invalid nested value",
      path: ["items", 2, { key: "price" }] as const,
    };
    const resolved = resolveExtractSchema(
      dualStandardSchema({
        validate: () => ({ issues: [issue] }),
        input: { type: "array" },
        output: { type: "array" },
      }),
    );

    await expect(resolved.validate([])).rejects.toMatchObject({ issues: [issue] });
  });

  it("preserves failures thrown by async validators as their cause", async () => {
    const cause = new Error("validator crashed");
    const resolved = resolveExtractSchema(
      dualStandardSchema({
        validate: async () => {
          throw cause;
        },
        input: { type: "string" },
        output: { type: "string" },
      }),
    );

    await expect(resolved.validate("value")).rejects.toBe(cause);
  });

  it("rejects partial standard capabilities", () => {
    const validateOnly = {
      "~standard": {
        version: 1,
        vendor: "validate-only",
        validate: (value: unknown) => ({ value }),
      },
    };
    const jsonSchemaOnly = {
      "~standard": {
        version: 1,
        vendor: "json-only",
        jsonSchema: {
          input: () => ({ type: "string" }),
          output: () => ({ type: "string" }),
        },
      },
    };

    expect(isExtractSchemaIntent(validateOnly)).toBe(true);
    expect(() => resolveExtractSchema(validateOnly)).toThrow(/Standard JSON Schema/);
    expect(() => resolveExtractSchema(jsonSchemaOnly)).toThrow(/validation/);
  });

  it("rejects Zod versions without native dual-standard support", () => {
    expect(() => resolveExtractSchema(zod3.object({ name: zod3.string() }))).toThrow(
      /Zod 4\.2\.0 or newer/,
    );
    expect(() => resolveExtractSchema(zod41.z.object({ name: zod41.z.string() }))).toThrow(
      /Zod 4\.2\.0 or newer/,
    );
  });

  it("gives official adapter guidance to validate-only Valibot schemas", () => {
    expect(() => resolveExtractSchema(valibot.object({ name: valibot.string() }))).toThrow(
      /toStandardJsonSchema/,
    );
  });

  it("rejects schemas without a vendor before RPC", () => {
    const schema = dualStandardSchema({
      validate: (value) => ({ value }),
      input: { type: "string" },
      output: { type: "string" },
    });
    Object.defineProperty(schema["~standard"], "vendor", { value: "" });

    expect(() => resolveExtractSchema(schema)).toThrow(/vendor name/);
  });

  it("rejects unsupported standard versions", () => {
    const schema = dualStandardSchema({
      validate: (value) => ({ value }),
      input: { type: "string" },
      output: { type: "string" },
    });
    Object.defineProperty(schema["~standard"], "version", { value: 2 });

    expect(() => resolveExtractSchema(schema)).toThrow(/version 1/);
  });

  it("adds vendor and target context to converter failures", () => {
    const schema = failingSchema(() => {
      throw new Error("unsupported target");
    });

    try {
      resolveExtractSchema(schema);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(StagehandSchemaError);
      expect((error as StagehandSchemaError).vendor).toBe("broken-converter");
      expect((error as Error).message).toContain("draft-2020-12");
      expect((error as Error).cause).toBeInstanceOf(Error);
    }
  });

  it("rejects malformed converter output and unsupported inputs", () => {
    expect(() => resolveExtractSchema(failingSchema(() => "not an object"))).toThrow(
      /return an object/,
    );
    expect(() =>
      resolveExtractSchema(failingSchema(() => ({ type: "string", invalid: () => true }))),
    ).toThrow(/JSON-safe/);
    expect(() => resolveExtractSchema({ type: "string" })).toThrow(StagehandSchemaError);
    expect(isExtractSchemaIntent({ type: "string" })).toBe(false);
  });

  it("rejects malformed Draft 2020-12 keyword shapes", () => {
    for (const schema of [
      { type: 42 },
      { properties: [] },
      { anyOf: [] },
      { required: ["name", "name"] },
      { minItems: -1 },
      { pattern: "[" },
    ]) {
      expect(() => resolveExtractSchema(failingSchema(() => schema))).toThrow(
        /JSON Schema (keyword|pattern)/,
      );
    }
  });

  it("rejects nested identifier scopes before schemas can be relocated", () => {
    expect(() =>
      resolveExtractSchema(
        failingSchema(() => ({
          type: "object",
          properties: { child: { $id: "nested", type: "string" } },
        })),
      ),
    ).toThrow(/nested identifier scope/);
  });

  it("clones prototype-sensitive keys without invoking accessors or retaining aliases", () => {
    const properties = JSON.parse(
      '{"__proto__":{"type":"string"},"constructor":{"type":"number"},"toString":{"type":"boolean"}}',
    ) as Record<string, unknown>;
    const shared = { type: "string" };
    const source = {
      type: "object",
      properties: { ...properties, first: shared, second: shared },
    };
    const cloned = validateDynamicJsonSchema(source);

    expect(Object.hasOwn(cloned.properties as object, "__proto__")).toBe(true);
    expect(cloned).not.toBe(source);
    expect(cloned.properties).not.toBe(source.properties);
    expect((cloned.properties as Record<string, unknown>).first).not.toBe(
      (cloned.properties as Record<string, unknown>).second,
    );
    (cloned.properties as Record<string, unknown>).first = { type: "number" };
    expect((cloned.properties as Record<string, unknown>).second).toStrictEqual({
      type: "string",
    });
    expect(source.properties.first).toBe(shared);

    let getterCalled = false;
    const accessorSchema = {};
    Object.defineProperty(accessorSchema, "type", {
      enumerable: true,
      get() {
        getterCalled = true;
        return "string";
      },
    });
    expect(() => validateDynamicJsonSchema(accessorSchema)).toThrow(/accessors/);
    expect(getterCalled).toBe(false);

    const symbolSchema = { type: "string", [Symbol("secret")]: true };
    expect(() => validateDynamicJsonSchema(symbolSchema)).toThrow(/symbol keys/);
  });

  it("bounds interpreted validation work for pathological compositions", () => {
    const schema = validateDynamicJsonSchema({
      anyOf: Array.from({ length: 100 }, () => ({ type: "array", items: { type: "number" } })),
    });
    const value = Array.from({ length: 20_000 }, () => 1);

    expect(() => assertDynamicValidationWork(schema, value)).toThrow(/work limit/);
  });

  it("rejects unsupported dialects and external references", () => {
    expect(() =>
      resolveExtractSchema(
        failingSchema(() => ({ $schema: "http://json-schema.org/draft-07/schema#" })),
      ),
    ).toThrow(/draft 2020-12/);
    expect(() =>
      resolveExtractSchema(failingSchema(() => ({ $ref: "https://example.com/schema.json" }))),
    ).toThrow(/local and self-contained/);
    expect(() => resolveExtractSchema(failingSchema(() => ({ $ref: "#/$defs/missing" })))).toThrow(
      /does not resolve/,
    );
  });

  it("rejects schemas that exceed resource limits", () => {
    let nested: Record<string, unknown> = { type: "string" };
    for (let depth = 0; depth < 66; depth += 1) nested = { allOf: [nested] };

    expect(() => resolveExtractSchema(failingSchema(() => nested))).toThrow(/maximum depth/);

    const $defs: Record<string, unknown> = {};
    for (let index = 0; index < 257; index += 1) {
      $defs[`node${index}`] =
        index === 256 ? { type: "string" } : { $ref: `#/$defs/node${index + 1}` };
    }
    expect(() =>
      resolveExtractSchema(failingSchema(() => ({ $ref: "#/$defs/node0", $defs }))),
    ).toThrow(/reference chain/);
  });
});

describe("runtime schema differential behavior", () => {
  it("matches representative legacy validation across 1,024 deterministic mutations", () => {
    const legacy = z
      .strictObject({
        name: z.string().trim().min(1),
        count: z.number().int().nonnegative().default(0),
        tags: z
          .array(z.enum(["a", "b"]))
          .max(3)
          .optional(),
      })
      .transform((value) => ({ ...value, label: `${value.name}:${value.count}` }));
    const replacement = z
      .strictObject({
        name: z.string().trim().min(1),
        count: z.number().int().nonnegative().default(0),
        tags: z
          .array(z.enum(["a", "b"]))
          .max(3)
          .optional(),
      })
      .required({ name: true })
      .transform((value) => ({ ...value, label: `${value.name}:${value.count}` }));

    let state = 0x5eed1234;
    const random = () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };

    for (let index = 0; index < 1_024; index += 1) {
      const candidate: Record<string, unknown> = {};
      if (random() > 0.2) candidate.name = random() > 0.2 ? ` item-${index} ` : index;
      if (random() > 0.45) candidate.count = random() > 0.25 ? Math.floor(random() * 5) : -1.5;
      if (random() > 0.55) {
        candidate.tags = Array.from({ length: Math.floor(random() * 5) }, () =>
          random() > 0.2 ? (random() > 0.5 ? "a" : "b") : "invalid",
        );
      }
      if (random() > 0.85) candidate.extra = true;

      const legacyResult = legacy.safeParse(candidate);
      const replacementResult = replacement.safeParse(candidate);
      expect(replacementResult.success, `mutation ${index}`).toBe(legacyResult.success);
      if (legacyResult.success && replacementResult.success) {
        expect(replacementResult.data, `mutation ${index}`).toStrictEqual(legacyResult.data);
      }
    }
  });
});

function dualStandardSchema<Input, Output>(config: {
  validate: import("@standard-schema/spec").StandardSchemaV1.Props<Input, Output>["validate"];
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}): StagehandSchema<Input, Output> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      types: undefined,
      validate: config.validate,
      jsonSchema: {
        input: () => config.input,
        output: () => config.output,
      },
    },
  };
}

function failingSchema(convert: () => unknown): unknown {
  return {
    "~standard": {
      version: 1,
      vendor: "broken-converter",
      validate: (value: unknown) => ({ value }),
      jsonSchema: { input: convert, output: convert },
    },
  };
}
