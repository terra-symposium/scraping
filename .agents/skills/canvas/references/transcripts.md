# Transcript handling and inventory

Use this reference after obtaining files through the authorized, visible course and recording interfaces. It documents the repository's existing local inventory helper; it does not provide a way to access Canvas remotely.

## What to save

Keep original transcript or caption files (`.txt`, `.vtt`, or `.srt`) unchanged in a source directory. Put normalized weekly output in a separate sibling directory so the helper does not scan its own output. Preserve the source filename and relative path; do not rename ambiguous files merely to make their week appear certain.

For each source, record what is known:

| Field                         | Record                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `week`                        | Confirmed course week; use a manual mapping when the filename is ambiguous.                        |
| `meetingTitle`, `meetingDate` | Visible meeting title and date, if present.                                                        |
| `platform`                    | Zoom or the platform actually used.                                                                |
| `captureMethod`               | For example, `Zoom transcript download`, `visible captions copied`, or `local speech-to-text`.     |
| `transcriptOrigin`            | Source-provided transcript/captions or generated transcript.                                       |
| `language`                    | Known transcript language.                                                                         |
| `visibleVerification`         | Whether the file was checked against the visible recording/transcript UI.                          |
| `captionStatus`               | Such as complete, partial, or not shown.                                                           |
| `expectedIds`                 | Optional expected meeting identifiers used for coverage matching.                                  |
| `recordingUrl`                | Optional canonical page URL only; omit query strings, fragments, passwords, and signed parameters. |

Do not include credentials, access codes, student data, grades, participant lists, or copied Zoom invite details in the mapping. The helper only copies a whitelist of metadata fields into its manifest and sanitizes `recordingUrl`, but source records should still be privacy-reviewed.

## Optional source mapping

Use a JSON object keyed by a source-relative path or filename when week, title, date, or provenance cannot be safely inferred. Example:

```json
{
	"sources": {
		"week-03/lecture-caption.txt": {
			"week": 3,
			"meetingTitle": "Transport layer lecture",
			"meetingDate": "2026-03-18",
			"platform": "Zoom",
			"captureMethod": "Zoom transcript download",
			"transcriptOrigin": "source transcript",
			"language": "en",
			"visibleVerification": true,
			"captionStatus": "complete"
		}
	}
}
```

Without a mapping, the helper assigns a week only when it finds one unambiguous week/lecture/session pattern in the source path. A unique basename can match a mapping, but repeated basenames are marked ambiguous; use the full relative path in that case. It does not infer a week from transcript body text.

An optional expected-meetings JSON file contains a `meetings` array. Each entry needs a stable `id` and integer `week`; it may include `title`, `required`, `matchAny`, and `expectedIds`. Matching is based on normalized source path, filename, mapped meeting title, and expected IDs. Review the manifest: a lexical match is a coverage aid, not proof that the transcript is complete or belongs to that meeting.

## Run the local inventory helper

From a consuming repository root:

```sh
pnpm run canvas:transcripts -- \
  --input=/path/to/transcript-sources \
  --output=/path/to/transcript-inventory \
  --weeks=12 \
  --mapping=/path/to/source-map.json \
  --expected=/path/to/expected-meetings.json
```

`--mapping` and `--expected` are optional. The script reads only local files, accepts `.txt`, `.vtt`, and `.srt`, and writes `Week-01.txt` through the requested week count plus `transcripts-manifest.json`. WebVTT and SRT files are candidates by extension. A plain `.txt` file must have a transcript-related name or an explicit source mapping to be inventoried. The helper does not access Canvas, Zoom, or other network services and does not write to Terra Docs.

The output includes source paths, SHA-256 hashes, byte sizes, assigned week and evidence method, safe mapped metadata, duplicate sources, unresolved week candidates, read errors, per-week status, and expected-meeting gaps. Exact duplicate content is detected by SHA-256 within each week; review the source list because deduplication does not establish semantic equivalence. Mapping and expected-input file names and hashes are recorded for reproducibility.

Review `transcripts-manifest.json` before using the generated week files. Resolve `unresolved` or `ambiguous` matches from visible source evidence, verify partial weeks, and retain gaps rather than inventing transcript text. Do not treat `found` as a quality or completeness verdict: it means a candidate file was assigned and required meeting IDs were matched.

Treat the manifest as the audit record for transcript provenance and coverage. The generated week files may prepend provenance for local review, but do not copy that inventory commentary into a published document. Follow the destination repository’s authoring guidance. Keep every generated claim traceable to the reviewed source files and manifest.

## Source fidelity

- Keep source transcript/caption files untouched; generated week files prepend provenance and may combine distinct source files with separators.
- Mark machine transcription and manual caption copying explicitly. Do not represent either as a platform-provided transcript.
- Preserve original timestamps and speaker markers where present. Mark inaudible spans instead of guessing.
- If names are redacted, label the derivative as redacted and preserve the unredacted source only when the user is authorized to retain it and local privacy rules allow it.
- Never use screenshots or copy content from material whose instructions prohibit recording or taking it out of Canvas.
