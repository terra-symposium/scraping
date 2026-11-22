---
name: canvas
description: Collect authorized Canvas course materials and transcripts with
  source provenance.
metadata:
  related-files:
    - src/canvas.ts
    - src/collection.ts
    - tests/canvas.test.mjs
---

# Canvas collection

Use this skill to collect permitted Canvas pages, files, recordings, and transcripts into a local export.

## Access boundary

- Use the ordinary access of the signed-in account. For an explicitly requested local collection, the shared `scrapeCanvas` workflow may open headed Chromium and wait for interactive sign-in. Keep session state outside the repository. For manual collection, use the user's in-app browser and follow visible controls.
- Do not use hidden endpoints, extracted cookies, browser storage, or a password bypass. The shared collector may request the Canvas file download endpoint exposed by an accessible file link.
- Never defeat a login, recording password, download restriction, enrollment boundary, paywall, disabled control, or other access check. If standard navigation cannot open a source, record it as inaccessible and explain the visible blocker.
- Respect restrictions stated on course pages and source material. For example, if a test or exam page prohibits copying or taking content out, do not capture its questions, answers, screenshots, or recording; record only that the restricted item was excluded.
- Keep this work read-only in Canvas. Do not post, submit, change course settings, or publish notes as part of collection.

## Collection workflow

1. Confirm the course and intended scope from the user's request. For a local automated capture, call `scrapeCanvas` with explicit source URL, output path, and external storage-state path. Otherwise use the signed-in in-app browser to follow the normal UI.
2. Build a coverage inventory before drafting notes: module order and title, each visible item, item type, source URL with secret query parameters removed, retrieval status, and a short reason for any exclusion or failure. Do not claim completeness when Canvas shows locked, unpublished, missing, or inaccessible material.
3. Read the full permitted page or file. For linked materials, use the Canvas interface's normal preview or download control. Preserve original names where practical, and keep extracted text separate from generated explanations.
4. Find recordings through the course's visible navigation, such as its Zoom, recordings, or lecture links. For each meeting, preserve its visible title/date and platform. Open the recording details in a new tab when useful, then use only its ordinary transcript, captions, or download controls.
5. Capture transcript text verbatim when available. Preserve timestamps and speaker labels if they are part of the source; do not silently fill gaps, rewrite unclear speech, or merge separate meetings. Note whether the transcript is a Zoom transcript, caption file, manual copy of visible captions, or speech-to-text output.
6. Reconcile the final inventory against all visible modules and expected meetings. Report completed, missing, duplicate, ambiguous-week, inaccessible, and excluded items separately. Save `coverage.json` next to the local source files, with one record per visible item: module, title, type, safe source URL, local relative path (or `null`), retrieval status, capture method, and any exclusion or failure reason. Check that each saved path exists and that every visible item has exactly one record. For transcripts, also use the helper manifest described below.
7. Validate the `CollectedItem` records with `checkCollection`, then hand the capture to the consuming repository. The consumer owns routing, note layout, conflict policy, and application of additions. Never present an incomplete source set as exhaustive.

## Transcript handling

Use [transcript provenance](references/transcripts.md) for local formats, source mapping, and coverage. The `canvas:export` CLI and `scrapeCanvas` API are user-initiated collection routes. They record one item per visible source, with source ID, section, safe URL, type, retrieval status, local path, and reason. They do not choose a note destination or overwrite authored content.

## Privacy

Collect only requested course material. Exclude grades, student lists, submissions, and private chat. Keep credentials, access codes, browser state, and signed URL parameters out of files and logs. Use an external AI processor only when the user selects it and course rules permit it.
