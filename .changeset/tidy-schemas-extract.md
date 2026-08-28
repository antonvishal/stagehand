---
"@browserbasehq/stagehand": major
"@browserbasehq/stagehand-protocol": patch
---

`extract()` now accepts schemas that implement both Standard Schema V1 validation and Standard
JSON Schema V1 conversion. Zod 4.2+ works through Stagehand's compatibility adapter, while newer
Zod versions and ArkType provide both capabilities natively. Effect uses its
`toStandardSchemaV1()` and `toStandardJSONSchemaV1()` adapters. Valibot requires its official
`toStandardJsonSchema()` adapter. TypeBox and hand-written Draft 2020-12 documents can use
`jsonSchema()`.

`ExtractResult<typeof schema>` still types `data` from that schema. Remaining TypeScript breaks:

- Custom schema implementations must provide both `~standard.validate` and Standard JSON Schema
  `input` and `output` converters. Validate-only Standard Schema implementations are rejected.
- Zod integrations require Zod 4.2.0 or newer. Conversion uses the schema's input JSON Schema
  representation and sets `additionalProperties: false` on objects that left the keyword unspecified.
- Validation failures now throw `StagehandValidationError` with the original Standard Schema issues.
  Schema conversion failures throw `StagehandSchemaError` before RPC. The extension hardens
  Draft 2020-12 after RPC and rejects profiles that the interpreter cannot run.

`jsonSchema()` accepts a JSON object and does not interpret it in the SDK. Stagehand uses
`@standard-schema/spec` for the exported interoperability contract. The extension uses
`@cfworker/json-schema` for its bounded CSP-safe runtime interpreter.
