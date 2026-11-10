# Canvas Scraping

Shared Canvas module capture and transcript inventory tools for Terra Symposium applications. The source of truth is the [Terra-Symposium/canvas-scraping repository](https://github.com/Terra-Symposium/canvas-scraping), consumed by Website and Uni Notes through a pinned Git dependency.

The library exports reusable Canvas discovery and capture functions. Its `canvas-export` command saves module pages, links, attachments, a manifest, and a log locally. Its `canvas-transcripts` command inventories transcript files already saved to disk. The tools do not publish to Terra Docs/Sanity or send course material to an AI provider.

## Install

The Website and Uni Notes repositories pin this package to a release tag and build it during dependency installation. If you use the commands in another project, add the package as a Git dependency and install the Playwright Chromium browser once:

```sh
pnpm add 'github:Terra-Symposium/canvas-scraping#v0.1.0'
pnpm exec playwright install chromium
```

## Export Canvas modules

```sh
pnpm run canvas:export -- --headed --canvas-url=https://canvas.example.edu/dashboard --groups="Week 1,Week 2"
```

The default output directory is `~/Downloads/canvas-export`. The first headed run opens a visible browser for sign-in and saves Playwright state outside the repository, under the user's application-support directory. Later runs can omit `--headed`. Use `--all-courses` to include visible courses whose titles do not contain a semester and year, or `--output=PATH` to choose another output directory.

The exporter only collects courses and module items available to the signed-in account. Review course rules and the visible page before including material. It does not collect grades, submissions, rosters, or private messages.

## Inventory local transcripts

```sh
pnpm run canvas:transcripts -- \
  --input=/path/to/transcript-sources \
  --output=/path/to/transcript-inventory \
  --weeks=12 \
  --mapping=/path/to/source-map.json \
  --expected=/path/to/expected-meetings.json
```

`--mapping` and `--expected` are optional. The helper reads `.txt`, `.vtt`, and `.srt` files only; it does not access Canvas or another network service. It writes one `Week-##.txt` file per requested week and a `transcripts-manifest.json` with hashes, provenance, duplicates, unresolved sources, and coverage gaps.

## Library API

Applications can use the same discovery and capture routines with their own authenticated Playwright context:

```ts
import { scrapeCanvasCourse } from '@terra-symposium/canvas-scraping';

const groups = await scrapeCanvasCourse({
  page,
  request: context.request,
  course: { title: 'Network Fundamentals', url: 'https://canvas.example.edu/courses/123' },
  output: '/tmp/canvas-export',
  groupMatches: ['Week 1'],
  log: (message) => console.log(message),
});
```

The returned groups contain the captured text, local file paths, safe source URLs, links, errors, and the path to each group's text file. Consumers remain responsible for authentication, storage, note formats, and any product-specific publishing.

## Access and privacy

The CLI is a user-run local tool. For agent-led Canvas collection, use the approved in-app browser workflow; do not use this Playwright CLI as an agent access route. Never commit browser storage, tokens, course exports, or transcript files to this repository.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
