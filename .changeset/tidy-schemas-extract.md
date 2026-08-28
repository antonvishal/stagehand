---
"@browserbasehq/stagehand": major
"@browserbasehq/stagehand-protocol": patch
---

Complete the MCP-style schema seam for `stagehand.extract()`: native Standard Schema V1 plus
Standard JSON Schema V1 implementations remain library-neutral, while `jsonSchema()` builds a
closed object schema from TypeBox or hand-written Draft 2020-12 property definitions. Stagehand's
bounded, CSP-safe interpreter validates the result. Stagehand-owned schemas remain genuine Zod
schemas, Zod stays an exact
production dependency at `4.5.0-canary.20260827T054049`, and TypeBox is not a runtime dependency.

Also export `standardSchemaToJsonSchema()` and `validateStandardSchema()`, preserve final validation
in the caller's original schema implementation, and keep support for Zod 4.2+, ArkType 2.1.28+,
and adapted Valibot 1.2+/`@valibot/to-json-schema` 1.5+.
