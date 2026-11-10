---
title: Scraping
description: Shared browser workflows and local scraping tools for Terra Symposium.
---

# Terra Symposium Scraping

Terra Symposium Scraping is the shared workflow package used by the Terra Symposium Website and Uni Notes. It centralizes browser setup, authentication-state handling, parallel work, Canvas collection, Australian syllabus downloads, and offline transcript inventory.

## Start here

- [Browser sessions](workflows/browser-sessions.md) explains headed and headless runs.
- [Parallel work](workflows/parallel-work.md) covers worker counts and process slots.
- [Canvas export](workflows/canvas.md) documents course and module capture.
- [Syllabus acquisition](workflows/syllabus.md) covers all Australian jurisdictions.
- [Transcript inventory](workflows/transcripts.md) documents the offline tool.
- [Consumer integration](workflows/consumer-integration.md) covers Website and Uni Notes usage.
- [Quality and releases](development/quality-and-release.md) covers maintenance and versioning.
- [API reference](api/index.md) lists the exported helpers.

The package collects source material to local files. Website-specific AI generation and Sanity publishing remain in the Website repository. Uni Notes decides when reviewed exports become Markdown in its content tree.
