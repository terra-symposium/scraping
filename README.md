# Scraping

Scraping helps Terra projects collect permitted course and syllabus information through repeatable
browser tasks.

## Get started

Use Node.js 20 or later. Install dependencies and the browser from the repository root:

```sh
pnpm install
pnpm run build
pnpm exec playwright install chromium
```

The package's full setup and API reference are in the
[Scraping docs](config/docs/01-scraping/01-getting-started/01-overview.mdx).

## Usage

Consumers pin a reviewed Git tag:

```sh
pnpm add 'github:Terra-Symposium/scraping#v0.2.0'
```

Run the command for the task at hand:

```sh
pnpm exec canvas-export --canvas-url=https://canvas.example.edu/dashboard --headed
pnpm exec syllabus-fetch --state=NSW --headed
pnpm exec canvas-transcripts --input=SOURCE --output=RESULT --weeks=12
```

The first headed Canvas run can complete a normal sign-in; later runs can reuse saved state. See
[browser sessions](config/docs/01-scraping/02-guides/01-browser-sessions.mdx),
[parallel work](config/docs/01-scraping/02-guides/02-parallel-work.mdx), and the
[API reference](config/docs/01-scraping/03-reference/index.mdx) for application integration.

## Configuration

Browser state lives outside the repository by default and contains credentials. Keep it private.
`PW_WORKERS`, `PW_HEADED_WORKERS`, and `PW_<DOMAIN>_WORKERS` limit parallel work. The
[browser guide](config/docs/01-scraping/02-guides/01-browser-sessions.mdx) covers state paths and
session lifecycle.

## Validation

| Command                | Checks                        |
| ---------------------- | ----------------------------- |
| `pnpm run quality`     | Changed and untracked files   |
| `pnpm run quality:all` | Full configured Quality scope |
| `pnpm run test`        | Project test suite            |
| `pnpm run build`       | Build output                  |

Quality can apply safe fixes; review the diff before committing. No separate browser or Playwright
test command is defined here.

## Contributing

`src/workflows/` owns shared browser and concurrency behavior; service-specific selectors belong in
their adapters. The
[quality and release guide](config/docs/01-scraping/04-maintenance/01-quality-and-release.mdx)
describes the checks and Git-tag release process.

Open a pull request against `development` and review the results of
[`check.yml`](.github/workflows/check.yml) before merging. Keep unrelated changes out of the pull
request.

## Documentation

- [Getting started](config/docs/01-scraping/01-getting-started/01-overview.mdx)
- [Canvas export](config/docs/01-scraping/02-guides/03-canvas-export.mdx)
- [Australian syllabus](config/docs/01-scraping/02-guides/04-australian-syllabus.mdx)
