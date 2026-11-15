---
name: canvas
description: Collect authorized Canvas course materials and transcripts with source provenance.
metadata:
  related-files:
    - src/canvas.ts
    - tests/canvas.test.mjs
---

# Canvas collection

Use this skill to collect permitted Canvas pages, files, recordings, and transcripts into a local export.

## Access boundary

- Use the user's in-app browser for all Canvas navigation and content access. Follow links and controls rendered in the signed-in Canvas interface; use only the account's ordinary access and any course-provided password the user is authorized to use.
- Do not use another browser, Playwright, Canvas APIs, hidden endpoints, cookies, local storage, browser profiles, or command-line download tools to access Canvas or a linked recording. Do not probe for or invent a password bypass. If the in-app browser is disabled, the user must enable it; stop Canvas access until then.
- Never defeat a login, recording password, download restriction, enrollment boundary, paywall, disabled control, or other access check. If standard navigation cannot open a source, record it as inaccessible and explain the visible blocker.
- Respect restrictions stated on course pages and source material. For example, if a test or exam page prohibits copying or taking content out, do not capture its questions, answers, screenshots, or recording; record only that the restricted item was excluded.
- Keep this work read-only in Canvas. Do not post, submit, change course settings, or publish notes as part of collection.

## Collection workflow

1. Confirm the course and intended scope from the user's request. Use the signed-in in-app browser to open the course and follow its Modules, Pages, Files, and linked course resources in the normal UI.
2. Build a coverage inventory before drafting notes: module order and title, each visible item, item type, source URL with secret query parameters removed, retrieval status, and a short reason for any exclusion or failure. Do not claim completeness when Canvas shows locked, unpublished, missing, or inaccessible material.
3. Read the full permitted page or file. For linked materials, use the Canvas interface's normal preview or download control. Preserve original names where practical, and keep extracted text separate from generated explanations.
4. Find recordings through the course's visible navigation, such as its Zoom, recordings, or lecture links. For each meeting, preserve its visible title/date and platform. Open the recording details in a new tab when useful, then use only its ordinary transcript, captions, or download controls.
5. Capture transcript text verbatim when available. Preserve timestamps and speaker labels if they are part of the source; do not silently fill gaps, rewrite unclear speech, or merge separate meetings. Note whether the transcript is a Zoom transcript, caption file, manual copy of visible captions, or speech-to-text output.
6. Reconcile the final inventory against all visible modules and expected
   meetings. Report completed, missing, duplicate, ambiguous-week,
   inaccessible, and excluded items separately. Save `coverage.json` next to
   the local source files, with one record per visible item: module, title,
   type, safe source URL, local relative path (or `null`), retrieval status,
   capture method, and any exclusion or failure reason. Check that each saved
   path exists and that every visible item has exactly one record. For
   transcripts, also use the helper manifest described below.
7. Only after source collection and coverage review, create the requested notes. Keep source identity, retrieval method, status, and safe source URLs in the local coverage manifest so claims remain traceable. Clearly distinguish source text, paraphrase, inference, and machine-generated transcription in working materials where useful, and do not present an incomplete source set as exhaustive.


## Transcript handling

Use [transcript provenance](references/transcripts.md) for local formats, source mapping, and coverage.
The repository's `canvas:export` CLI is a live Canvas collector: it uses
Playwright navigation and API requests. Do not invoke it for this workflow,
because the access boundary above requires the user's in-app browser. Local
post-processing of files already collected through that browser is allowed.

## Privacy

Collect only requested course material. Exclude grades, student lists, submissions, and private chat.
Keep credentials, access codes, browser state, and signed URL parameters out of files and logs.
Use an external AI processor only when the user selects it and course rules permit it.
