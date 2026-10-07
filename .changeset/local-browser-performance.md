---
"@browserbasehq/stagehand": patch
"@browserbasehq/stagehand-extension": patch
"@browserbasehq/stagehand-go": patch
"@browserbasehq/stagehand-python": patch
---

Reduce local browser CPU and memory use by disabling Chrome's spare renderer, minifying the extension, skipping suppressed CDP logging, and reusing locator setup and handles. Resolve nth matches directly and remove quadratic text-selector filtering. Release child-frame references during page and context cleanup, and reduce heartbeat wakeups. Merge caller feature flags with defaults while preserving parameter overrides.
