---
title: Consumer integration
description: Install and use the shared workflows from Terra Symposium Website and Uni Notes.
---

# Consumer integration

Website and Uni Notes install this package from a reviewed Git tag. The package handles reusable browser, authentication, concurrency, Canvas, syllabus, and transcript work. Each consumer keeps its application-specific output and review flow.

## Install a reviewed tag

From the consumer repository, add the tag approved for that application:

    pnpm add 'github:Terra-Symposium/scraping#v0.2.0'

After updating the dependency, install with the repository's lockfile and permit the package's build step using that repository's pnpm policy. Keep the resolved Git commit in the consumer lockfile.

## Reuse browser and authentication helpers

Use `authenticateWorkflow` when the consumer can provide page setup and an app-specific readiness predicate. A headless workflow can reuse an existing storage-state file; `interactive: true` permits a visible browser for manual sign-in when needed.

```ts
import { authenticateWorkflow } from '@terra-symposium/scraping';

const session = await authenticateWorkflow({
  sessionName: 'website-canvas',
  headed: false,
  interactive: true,
  open: async context => {
    const page = await context.newPage();
    await page.goto('https://canvas.example.edu/dashboard');
    return page;
  },
  isReady: async page => page.locator('.ic-DashboardCard__link').first().isVisible().catch(() => false),
});

try {
  await collect(session.value);
} finally {
  await session.close();
}
```

Website can supply `createSession` when it must preserve its Chrome channel or persistent-profile selection. Its Gemini and Sanity selectors, account checks, screenshots, and AI generation remain Website-owned.

## Reuse concurrency helpers

Use `resolveWorkerCount` for consistent CLI and environment precedence, `runQueued` for a bounded in-process queue, and `acquireWorkflowSlot` when separate processes must share a limit. Always release acquired slots in `finally` blocks. Configure the limit for the external service and local machine in the consumer repository.

## Use curriculum workflows

Call `fetchAustralianSyllabus` to download a configured jurisdiction's Word file or `normalizeSyllabusDocument` for a local Word file or ZIP. The shared workflow records a safe source URL and writes only to the requested local output directory. Website can continue with its own Gemini/Sanity transformations; Uni Notes controls Markdown generation and content review.

## Use Canvas and transcript tools

Run `canvas-export` for local Canvas course/module capture and `canvas-transcripts` for offline inventory of transcript files. The APIs under `@terra-symposium/scraping/canvas` also expose the page, file, filename, URL, and course helpers for custom consumers.

The package does not publish to Terra Docs or Sanity and does not decide whether captured material becomes a note. Consumers own that transformation, review, and publishing decision.
