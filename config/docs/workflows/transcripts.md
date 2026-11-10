---
title: Transcript inventory
description: Inventory local transcript and caption files with coverage and provenance metadata.
---

# Transcript inventory

The transcript helper works on files that are already saved locally. It does not access Canvas, Zoom, or another network service.

## Run the inventory

    canvas-transcripts --input=/path/to/transcript-sources --output=/path/to/transcript-inventory --weeks=12

Optional inputs add explicit source metadata and expected-meeting coverage:

    canvas-transcripts --input=EXPORT_DIR --output=TRANSCRIPT_DIR --weeks=12 --mapping=source-map.json --expected=expected-meetings.json

The input and output directories must differ. Supported source extensions are `.txt`, `.vtt`, and `.srt`. WebVTT and SRT files are candidates by extension. A plain text file needs a transcript-related name or an explicit mapping.

The tool writes one `Week-##.txt` file per requested week plus `transcripts-manifest.json`. The manifest records source-relative paths, hashes, byte sizes, week assignments and evidence, mapped metadata, duplicates, unresolved matches, read errors, per-week status, and expected-meeting gaps. It never invents missing transcript text.

## Review the result

Review the manifest before using generated week files. Resolve ambiguous assignments from visible source evidence, verify partial weeks, and retain gaps. A `found` status means that a candidate file was assigned and required meeting IDs matched; it does not prove the transcript is complete or accurate.

Exact duplicate content is detected by SHA-256 within each week. Review the source list because matching hashes do not prove semantic equivalence. Mapping and expected-input filenames and hashes are recorded for reproducibility.

Keep original transcript files unchanged. Mark machine transcription and manual caption copying as such, preserve timestamps and speaker markers, and mark inaudible spans rather than guessing. Do not collect course material whose rules prohibit taking it out of Canvas.
