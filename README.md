# Terra Symposium Scraping

Reusable browser workflows and local scraping tools for Terra Symposium Website and Uni Notes.

## What it does

- Shares headed and headless browser setup and authenticated session helpers.
- Shares bounded worker queues and cross-process workflow slots.
- Captures Canvas modules, downloads Australian syllabuses, and inventories transcripts.
- Leaves AI generation, publishing, and note formatting to the consuming application.

The detailed guides and API reference live in the [Docs instance](config/docs/index.md).

## Prerequisites

- Node.js 20 or later for the package and command-line tools.
- Node.js 24.12 or later and pnpm 10.30.3 for repository Docs and quality tools.
- Playwright Chromium for Canvas and syllabus browser workflows.

## Get started

From the repository root, install dependencies and build the package:

```sh
pnpm install
pnpm run build
```

Install Chromium once before running browser workflows:

```sh
pnpm exec playwright install chromium
```

The Docs instance has its own dependencies. From the repository root:

```sh
pnpm --dir config install
pnpm --dir config run docs
```

Open <http://127.0.0.1:2060/> to browse the local guides.

## Usage

### Install in Website or Uni Notes

Consumers pin this public Git repository to a reviewed tag:

```sh
pnpm add 'github:Terra-Symposium/scraping#v0.2.0'
```

### Capture Canvas course modules

```sh
pnpm exec canvas-export --canvas-url=https://canvas.example.edu/dashboard --headed --groups="Week 1,Week 2"
```

The default export is written to `~/Downloads/canvas-export`. Use `--output=PATH` to choose a different directory and `--all-courses` to include visible courses without a semester and year in the title. Run `canvas-export --help` for all options. The first headed run can complete a normal Canvas sign-in; later runs can reuse saved state in headless mode.

### Download an Australian syllabus

```sh
pnpm exec syllabus-fetch --state=NSW --headed
```

The helper supports ACT, NSW, NT, QLD, SA, TAS, VIC, and WA. It saves the downloaded Word file under `~/Downloads/terra-symposium-scraping/syllabuses` by default. See the [syllabus guide](config/docs/workflows/syllabus.md) for source details and API use.

### Inventory saved transcripts

```sh
pnpm exec canvas-transcripts --input=/path/to/sources --output=/path/to/inventory --weeks=12
```

The helper reads local `.txt`, `.vtt`, and `.srt` files. It writes weekly files and a manifest with provenance, duplicates, unresolved matches, and coverage gaps.

### Use the workflow API

```ts
import { authenticateWorkflow, resolveWorkerCount, runQueued } from '@terra-symposium/scraping';

const session = await authenticateWorkflow({
  sessionName: 'course-workflow',
  headed: false,
  interactive: true,
  open: async context => {
    const page = await context.newPage();
    await page.goto('https://example.edu/courses');
    return page;
  },
  isReady: async page => page.locator('[data-course-list]').isVisible().catch(() => false),
});

try {
  const failures = await runQueued(
    ['course-1', 'course-2'],
    resolveWorkerCount(2, 'courses'),
    async course => collectCourse(course, session.value),
  );
  console.log(failures);
} finally {
  await session.close();
}
```

See the [browser](config/docs/workflows/browser-sessions.md), [parallel work](config/docs/workflows/parallel-work.md), and [API](config/docs/api/index.md) guides for full contracts.

See the [consumer integration guide](config/docs/workflows/consumer-integration.md) for Website and Uni Notes boundaries.

## Configuration and security

| Name | Required | Purpose | Source |
| --- | --- | --- | --- |
| `PW_<DOMAIN>_WORKERS` | No | Worker limit for one workflow domain. | Shell or CI environment |
| `PW_HEADED_WORKERS` | No | Worker limit when `--headed` is present. | Shell or CI environment |
| `PW_WORKERS` | No | General worker limit. | Shell or CI environment |
| `storageStatePath` | No | Playwright state-file path for one workflow. | API option; default is OS user storage |

See [Browser sessions and authentication](config/docs/workflows/browser-sessions.md) for session lifecycle details.

The browser helpers store state outside the repository by default. State files contain credentials and must remain private. Canvas collection is a user-run local workflow; do not use the CLI or Playwright helpers as an agent route for Canvas access.

## Development and structure

```text
src/canvas.ts                 Canvas discovery and capture
src/workflows/browser.ts      Headed, headless, and authenticated sessions
src/workflows/parallel.ts     Worker counts, queues, and process slots
src/workflows/syllabus.ts     Curriculum pages and Word downloads
src/cli/                      Canvas, syllabus, and transcript commands
config/docs/                   Docs instance content
config/package.json            Docs and quality tooling
```

Website keeps its Gemini, Sanity, and product-specific generation logic. Uni Notes keeps its Markdown organization and content-review workflow.

## Validation

| Check | Command | Notes |
| --- | --- | --- |
| TypeScript build | `pnpm run build` | Emits declarations and JavaScript under `dist/`. |
| Full quality suite | `pnpm run quality` | Runs configured format, lint, static checks, build, and Docs build. |
| Docs build | `pnpm --dir config run build` | Writes the static site to `config/dist/docs`. |

See [Quality and releases](config/docs/development/quality-and-release.md) for the configured checks and release steps.

## Deployment and operations

Consumers use reviewed Git tags. Update the package version and Git tag together, then update the Website and Uni Notes pins. The repository CI runs the quality wrapper and builds the Docs site. No website host or npm publishing workflow is configured here.

## Data, privacy, and limitations

Canvas and syllabus files are saved locally. The package does not send collected content to an AI provider, write to Terra Docs/Sanity, or edit Uni Notes. Transcript inventory is offline. Public curriculum pages can change their markup or download controls; inspect the visible page when a workflow stops matching.

Use only material available through normal account access and allowed by the course or source terms. Keep browser state, exports, transcripts, and downloaded syllabuses out of Git.

## References

- [Docs guides and API reference](config/docs/index.md)
- [Canvas export guide](config/docs/workflows/canvas.md)
- [Syllabus acquisition guide](config/docs/workflows/syllabus.md)
- [Transcript inventory guide](config/docs/workflows/transcripts.md)

## Contributing

Keep shared browser and concurrency behavior in `src/workflows/`. Keep service-specific selectors in their workflow adapter. Run `pnpm run quality` before opening a change and keep private browser data out of commits.

## Credits and license

Licensed under Apache-2.0. See [LICENSE](LICENSE).
