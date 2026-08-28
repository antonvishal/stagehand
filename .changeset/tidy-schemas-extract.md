---
"@browserbasehq/stagehand": major
"@browserbasehq/stagehand-protocol": patch
---

`extract()` now accepts schemas that implement both Standard Schema V1 validation and Standard
JSON Schema V1 conversion. Zod 4.2.0+ works through Stagehand's compatibility adapter, while newer
Zod versions and ArkType provide both capabilities natively. Effect uses its
`toStandardSchemaV1()` and `toStandardJSONSchemaV1()` adapters. Valibot requires its official
`toStandardJsonSchema()` adapter. TypeBox and hand-written Draft 2020-12 documents can use
`jsonSchema()`.

`ExtractResult<typeof schema>` still types `data` from that schema. Remaining TypeScript breaks:

- Custom schema implementations must provide both `~standard.validate` and Standard JSON Schema
  `input` and `output` converters. Validate-only Standard Schema implementations are rejected.
- Zod integrations require Zod 4.2.0 or newer.
- Validation failures now throw `StagehandValidationError` with the original Standard Schema issues.
  Schema conversion and hardened-profile failures throw `StagehandSchemaError` before RPC.

`jsonSchema()` accepts a JSON object. Stagehand's hardened Draft 2020-12 profile is the runtime
contract. Stagehand uses `@standard-schema/spec` for the exported interoperability contract and
`@cfworker/json-schema` for its bounded CSP-safe runtime interpreter.
