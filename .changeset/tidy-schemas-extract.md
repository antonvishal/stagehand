---
"@browserbasehq/stagehand": major
"@browserbasehq/stagehand-protocol": patch
---

Restore genuine Zod schemas as Stagehand's owned schema surface and accept strict dual-standard
schemas in `stagehand.extract()`. Converter-produced Draft 2020-12 schemas now pass a hardened,
bounded interpreter path while final output validation remains authoritative in the caller's
original Standard Schema implementation.
