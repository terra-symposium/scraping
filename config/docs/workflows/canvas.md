---
title: Canvas export
description: Capture visible Canvas courses and module content into a local export folder.
---

# Canvas export

The Canvas workflow discovers courses and module groups in the signed-in account, captures readable module pages, downloads linked files, and writes a local manifest and log.

## Run the command

Install the package from its pinned Git tag, then install the Playwright browser once:

    pnpm add 'github:Terra-Symposium/scraping#v0.2.0'
    pnpm exec playwright install chromium

Run the exporter from the consuming repository:

    pnpm exec canvas-export --canvas-url=https://canvas.example.edu/dashboard --headed --groups="Week 1,Week 2"

The default output directory is `~/Downloads/canvas-export`. Use `--output=PATH` to change it and `--all-courses` to include visible courses without a semester and year in their titles. Run `canvas-export --help` for the complete option list.

A headed run can complete a normal Canvas sign-in and save Playwright state outside the repository. A later headless run reuses and checks the saved state. The command reads only material visible to the signed-in account and does not collect grades, submissions, rosters, or private messages.

## Use the library

```ts
import { authenticateWorkflow, discoverCanvasCourses, scrapeCanvasCourse } from '@terra-symposium/scraping';

const session = await authenticateWorkflow({
  sessionName: 'canvas',
  headed: true,
  interactive: true,
  open: async context => {
    const page = await context.newPage();
    await page.goto('https://canvas.example.edu/dashboard');
    return page;
  },
  isReady: async page =>
    page.locator('#context_modules, .ic-DashboardCard__link').first().isVisible().catch(() => false),
});

try {
  const courses = await discoverCanvasCourses(session.value, 'https://canvas.example.edu/dashboard');
  const first = courses[0];
  if (first) {
    await scrapeCanvasCourse({
      page: session.value,
      request: session.context.request,
      course: first,
      output: '/tmp/canvas-export',
    });
  }
} finally {
  await session.close();
}
```

The Canvas subpath also exports `normalizeCanvasUrl` and `isCanvasReady` for validation, `readCanvasPage` for page text and file links, and `downloadCanvasFile` for authenticated downloads. Filename utilities include `sanitizeCanvasFileName`, `inferCanvasFileName`, and `canvasResponseFileName`. Other helpers include `canvasCourseUrl`, `canvasFileUrl`, `canvasFileDownloadUrl`, `canvasSourceKey`, `safeCanvasUrl`, `getCanvasModuleGroups`, `scrapeCanvasGroup`, and `scrapeCanvas`.

Canvas access remains read-only. Review course rules and the visible page before including material. The Playwright CLI is for the user's own local run, not agent-led Canvas collection. Keep exports private and outside Git.
