---
name: syllabus
description: Collect and verify public curriculum source records for local
  scraping projects.
metadata:
  related-files:
    - src/workflows/syllabus.ts
    - tests/syllabus.test.mjs
---

# Syllabus collection

Use this skill for syllabus or curriculum collection in this repository. Read `config/docs/01-scraping/02-guides/04-australian-syllabus.mdx` and the current `syllabus-fetch` CLI before choosing inputs or output paths.

1. Confirm the authority, jurisdiction, year, subject, and requested scope.
2. For NSW, pass an explicit `--syllabus-name` matching the requested subject; the CLI defaults to English K–10. Confirm the source's actual year or stage selection before downloading. Use public, authorized source pages and the documented fetch command. Record source URL, retrieval time, version, and coverage without credentials or signed parameters. For a Mathematics Stage 4 request, inspect the picker for its exact Mathematics K–10 label, then run `pnpm exec syllabus-fetch --state=NSW --syllabus-name='<exact visible label>' --output=<local directory>`. Verify Stage 4 appears in the downloaded document; the picker name alone does not establish stage coverage.
3. The fetch command saves source material; extract and verify the requested records separately. Keep original captures separate from normalized records. For each extracted record, retain its source heading or identifier, parent hierarchy, exact wording, stage, source page or section, and source file path. Label inferred mappings; this is a review record, not the fetch API schema.
4. Reconcile counts and missing sections against the source before claiming completeness.
5. When changing the workflow or writing extracted records, run the narrow relevant tests and inspect the generated diff. For a read-only plan, report the checks to run later. Report inaccessible or ambiguous records instead of filling them from guesswork.
