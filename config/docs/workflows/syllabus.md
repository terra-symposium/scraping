---
title: Australian syllabus acquisition
description: Open curriculum pages, prepare the default state selection, and save Word downloads locally.
---

# Australian syllabus acquisition

The syllabus workflow opens one public curriculum source, prepares its download UI, and saves the resulting Word file. NSW uses its custom syllabus picker and defaults to `English K–10 (2022)`. The other state and territory entries open their configured curriculum page and use its visible **Download as Word** control.

## Fetch a syllabus

```ts
import { fetchAustralianSyllabus } from '@terra-symposium/scraping';

const syllabus = await fetchAustralianSyllabus({
  state: 'NSW',
  headed: false,
  outputDirectory: '/Users/you/Downloads/syllabuses',
});

console.log(syllabus.filePath);
```

The default output directory is `~/Downloads/terra-symposium-scraping/syllabuses`. The result includes the jurisdiction, safe source URL, saved path and filename, and capture time. Use `headed: true` to watch the flow. Set `interactive: true` to allow visible manual sign-in if a source requires it. State files are stored outside the repository by default.

`isAustralianSyllabusPageReady(page)` is exported for consumers that need the same public-page readiness rule in a custom authentication workflow.

The equivalent command is:

    syllabus-fetch --state=NSW --headed --output=/path/to/syllabuses

The CLI supports `--state`, `--output`, `--file-name`, `--syllabus-name`, `--headed`, `--interactive`, `--storage-state`, and `--timeout`. Run `syllabus-fetch --help` for the current option list.

## Jurisdictions

| State | Source | Special handling |
| --- | --- | --- |
| ACT | ACT Education and Training | Opens its curriculum page. |
| NSW | NSW Curriculum | Selects the configured syllabus, then prepares the Word export. |
| NT | NT Education | Opens its curriculum policy page. |
| QLD | Queensland Curriculum and Assessment Authority | Opens the P–10 resources page. |
| SA | South Australian Department for Education | Opens the Birth to Year 10 curriculum page. |
| TAS | Tasmanian Department for Education, Children and Young People | Opens the curriculum page. |
| VIC | Victorian Curriculum and Assessment Authority | Opens the Foundation to 10 resources page. |
| WA | School Curriculum and Standards Authority | Opens the K–10 curriculum browser. |

The URLs live in `AUSTRALIAN_SYLLABUS_SOURCES`. Public sites can change their page structure or available files. If the expected download control is missing, inspect the visible page and update the adapter with evidence from that site.

## Use a local syllabus file

`normalizeSyllabusDocument(path, options)` accepts `.doc`, `.docx`, and `.zip`. Word files are copied into the output directory. For ZIP files, it writes the first alphabetically sorted Word entry whose name does not look like syllabus support material; it does not unpack the rest of the archive. The helper does not convert Word formats.

Website uses this helper before its separate Gemini and Sanity template-generation stage. Uni Notes can use the saved file as a local source and decide independently whether to create notes.
