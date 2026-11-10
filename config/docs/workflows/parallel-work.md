---
title: Parallel work
description: Resolve worker limits, run bounded queues, and coordinate concurrent processes.
---

# Parallel work

The parallel helpers support both in-process batches and a cross-process limit for long-running browser work.

## Resolve worker counts

`resolveWorkerCount(fallback, domain)` reads the first valid positive integer in this order:

1. `--workers=N` or `--workers N`
2. `PW_<DOMAIN>_WORKERS`, when a domain was supplied
3. `PW_HEADED_WORKERS`, when the process includes `--headed`
4. `PW_WORKERS`
5. The supplied fallback (five by default)

For example, `resolveWorkerCount(4, 'canvas')` checks `PW_CANVAS_WORKERS`. Invalid, zero, negative, or unsafe values are ignored. CLI flags take priority over environment settings.

## Run a bounded queue

```ts
import { resolveWorkerCount, runQueued } from '@terra-symposium/scraping';

const failures = await runQueued(
  courseUrls,
  resolveWorkerCount(4, 'canvas'),
  async (courseUrl, index) => {
    await exportCourse(courseUrl, index);
  },
);
```

Every input is processed once. The helper catches per-item failures and returns `QueueFailure` records sorted by input index. It does not cancel sibling work when one item fails; callers decide whether to retry, report, or fail the whole workflow.

## Limit concurrent processes

```ts
import { acquireWorkflowSlot } from '@terra-symposium/scraping';

const release = await acquireWorkflowSlot({
  name: 'transcript-import',
  size: 2,
});

try {
  await importOneBatch();
} finally {
  await release();
}
```

Each lock file contains a process ID and is removed when released. Dead-process locks are cleared when encountered. The default lock directory is under the OS temporary directory and scoped to the current repository path and pool name. Pass `directory` when separate tools must share a specific lock pool. Pass an `AbortSignal` to stop waiting for a slot.

Use short-lived slots with `try/finally`. Do not acquire more slots than the external service or machine can safely support.
