---
title: Browser sessions and authentication
description: Build headed or headless Playwright sessions with reusable state and app-specific readiness checks.
---

# Browser sessions and authentication

The browser helpers standardize browser launch, storage-state reuse, interactive sign-in, and cleanup. Each workflow supplies its own pages and readiness check because Canvas, Gemini, and public curriculum pages have different login and account requirements.

## Launch a session

Import `launchWorkflowSession` for a temporary context or `withWorkflowSession` when a callback should own the session lifetime.

```ts
import { withWorkflowSession } from '@terra-symposium/scraping';

const titles = await withWorkflowSession(
  { headed: false, storageStatePath: '/secure/path/session.json' },
  async ({ context }) => {
    const page = await context.newPage();
    await page.goto('https://example.edu');
    return page.locator('h1').allTextContents();
  },
);
```

The browser is headless by default. Set `headed: true` to show Chromium. The helper loads the storage-state file only when that file exists. It accepts downloads by default. Call `session.close()` or use `withWorkflowSession` so the context and browser process are released.

`WorkflowBrowserOptions` also supports a persistent `userDataDir`, a browser `channel`, an explicit `executablePath`, and extra Chromium `args`. Use a persistent profile only when the owning application has a clear account-selection policy. Chromium cannot open the same profile concurrently in two processes.

## Authenticate with a readiness callback

Use `authenticateWorkflow` when a workflow can determine whether its existing signed-in state is useful.

```ts
import { authenticateWorkflow } from '@terra-symposium/scraping';

const session = await authenticateWorkflow({
  sessionName: 'course-notes',
  headed: false,
  interactive: true,
  open: async context => {
    const page = await context.newPage();
    await page.goto('https://example.edu/courses');
    return page;
  },
  isReady: async page =>
    page.locator('[data-course-list]').isVisible().catch(() => false),
  onInteractiveStart: () => console.log('Sign in in the visible browser.'),
});

try {
  console.log(await session.value.title());
} finally {
  await session.close();
}
```

If stored state passes `isReady`, it is saved and returned in the requested mode. If it fails and `interactive` is false, the helper closes the browser and throws. If interactive sign-in is enabled, the helper opens a visible session, waits up to `timeoutMs`, saves state, and verifies the state again. A headless caller gets a fresh headless session after sign-in; a headed caller keeps its visible session.

The default state file is outside the repository. `resolveWorkflowStorageStatePath(name)` returns a platform-specific path under the user's application-support directory. Pass `storageStatePath` to select another file. The saved file contains session credentials; keep it private and out of Git.

## Authenticated work is consumer-specific

The package does not guess that a browser is authenticated. Each consumer supplies `open` and `isReady` callbacks. Website keeps stricter checks for Canvas, Gemini, and Sanity. The Canvas command checks for Canvas course/module content. Public syllabus sources use a page-content check and can be retried with a visible interactive session if the site requires sign-in.

Do not use these user-run Playwright helpers as an agent route for accessing Canvas. Agent-led collection must follow the owning product's approved in-app browser workflow.
