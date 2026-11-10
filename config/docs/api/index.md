---
title: API reference
description: Public exports, options, and compatibility boundaries.
---

# API reference

Import public helpers from `@terra-symposium/scraping` or from the focused subpaths below. All APIs are exported with TypeScript declarations.

## Public entry points

| Entry point | Exports |
| --- | --- |
| `@terra-symposium/scraping` | Canvas, browser, parallel, and syllabus APIs. |
| `@terra-symposium/scraping/canvas` | Canvas discovery, capture, filename, and file-reading APIs. |
| `@terra-symposium/scraping/workflows/browser` | Browser launch, authenticated state, and cleanup. |
| `@terra-symposium/scraping/workflows/parallel` | Worker counts, bounded queues, and process slots. |
| `@terra-symposium/scraping/workflows/syllabus` | Australian curriculum downloads and document handling. |

## Browser workflow exports

- `launchWorkflowSession(options)` opens a headed or headless context.
- `withWorkflowSession(options, callback)` guarantees context cleanup.
- `authenticateWorkflow(options)` validates saved state and supports visible sign-in.
- `closeWorkflowSession(session)` closes an explicitly owned session.
- `resolveWorkflowStorageStatePath(name)` returns an OS-level default path.

See [Browser sessions and authentication](../workflows/browser-sessions.md) for option and lifecycle behavior.

## Parallel workflow exports

- `resolveWorkerCount(fallback, domain, options)` reads CLI and environment overrides.
- `runQueued(items, workerCount, execute)` runs bounded work and returns indexed failures.
- `acquireWorkflowSlot(options)` acquires a cross-process lock slot.

See [Parallel work](../workflows/parallel-work.md) for precedence, failure, and cancellation details.

## Syllabus workflow exports

- `AUSTRALIAN_SYLLABUS_SOURCES` maps every state and territory to its public page.
- `prepareAustralianSyllabusPage(page, state, options)` navigates and prepares the page.
- `isAustralianSyllabusPageReady(page)` checks whether a page is public and readable.
- `fetchAustralianSyllabus(options)` downloads its Word file and returns local provenance.
- `normalizeSyllabusDocument(path, options)` copies Word documents or extracts one from ZIP.

See [Syllabus acquisition](../workflows/syllabus.md) for jurisdiction and download behavior.

## Canvas exports

The Canvas API exports course and module types, safe URL and download endpoints, course discovery, module group discovery, per-page/per-group/per-course capture, and the complete local export runner. Lower-level helpers include:

- `normalizeCanvasUrl(value)` validates an HTTP(S) Canvas URL and removes credential data.
- `isCanvasReady(page)` checks whether a Canvas page has usable course or module content.
- `readCanvasPage(page, item)` captures page text and linked Canvas files.
- `downloadCanvasFile(request, value)` follows Canvas's authenticated file-download route.
- `sanitizeCanvasFileName(value)` and `inferCanvasFileName(name, contentType)` prepare disk names.
- `canvasResponseFileName(header)` reads plain and RFC 5987 disposition filenames.

The generated declarations in `dist/` describe exact parameter and result shapes.

See [Canvas export](../workflows/canvas.md) and the source modules under `src/` for details.
