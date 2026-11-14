# Complete repository test plan: scraping

This checklist inventories repository-owned functions, documents, and configuration as of the current working tree. It is a plan, not a claim that every item is already tested. Update it when an owned source or document changes.

## Scope and method

- Function entries identify the source path and line. Exercise the stated normal, edge, and failure scenarios; link or add assertions as each entry is completed.
- Document entries require rendering, link checking, and content review. Execute documented commands against the current repository.
- Generated output, dependencies, vendored trees, bundled course viewers, and Portfolio pinned `projects/` snapshots are covered through build, package, and integration checks rather than individual upstream functions. Keep those boundaries under review when their inputs change.
- Put produced reports, screenshots, traces, and coverage under `tests/results/`.

## Function and executable source inventory

### `config/eslint.config.mjs`

- [ ] File behavior: execute or compile this source, including expected output and failure handling. No direct test file is linked yet.

### `config/prettier.config.cjs`

- [ ] File behavior: execute or compile this source, including expected output and failure handling. No direct test file is linked yet.

### `eslint.config.mjs`

- [ ] File behavior: execute or compile this source, including expected output and failure handling. No direct test file is linked yet.

### `scripts/quality-runner.mjs`

- [ ] `callback@18` (line 18): Test expected input/output, empty and boundary cases, and a relevant failure path. No direct test file is linked yet.
- [ ] `callback@45` (line 45): Test expected input/output, empty and boundary cases, and a relevant failure path. No direct test file is linked yet.
- [ ] `isBuildOrTest` (line 50): Run on clean input; verify deterministic output and a useful failure on invalid input. No direct test file is linked yet.
- [ ] `callback@53` (line 53): Test expected input/output, empty and boundary cases, and a relevant failure path. No direct test file is linked yet.
- [ ] `callback@55` (line 55): Test expected input/output, empty and boundary cases, and a relevant failure path. No direct test file is linked yet.

### `src/canvas.ts`

- [ ] `ignoreCanvasWaitFailure` (line 122): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `ignoreCanvasVisibilityFailure` (line 131): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `defaultCanvasLogger` (line 141): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `ignoreCanvasLog` (line 149): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `readCanvasCourseLinks` (line 157): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `readRawCanvasGroups` (line 183): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `isCanvasNotModuleItemUrl` (line 201): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `hasCanvasReadableContent` (line 210): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `readCanvasBodyText` (line 224): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `readCanvasPageLinks` (line 241): Render each state; check interactions, accessibility, loading, and error behavior. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `safeCanvasUrl` (line 260): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `canvasFileUrl` (line 280): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `canvasFileDownloadUrl` (line 297): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `canvasSourceKey` (line 309): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `isCanvasPreviewBody` (line 325): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `canvasCourseUrl` (line 338): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `sMessage` (line 354): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `sName` (line 364): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `sanitizeCanvasFileName` (line 384): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `inferCanvasFileName` (line 399): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `canvasResponseFileName` (line 429): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `downloadCanvasFile` (line 453): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `discoverCanvasCourses` (line 472): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `collectCourses` (line 481): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `getCanvasModuleGroups` (line 511): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `readCanvasPage` (line 544): Render each state; check interactions, accessibility, loading, and error behavior. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `scrapeCanvasGroup` (line 570): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `scrapeCanvasCourse` (line 641): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `normalizeCanvasUrl` (line 663): Test valid, malformed, empty, and boundary input; assert exact output or error. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `isCanvasReady` (line 680): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `scrapeCanvas` (line 700): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `log` (line 711): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `openCanvasPage` (line 722): Render each state; check interactions, accessibility, loading, and error behavior. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).
- [ ] `notifyCanvasInteractiveStart` (line 732): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/canvas.test.mjs`](../tests/canvas.test.mjs).

### `src/cli/export.ts`

- [ ] `option` (line 23): Test expected input/output, empty and boundary cases, and a relevant failure path. No direct test file is linked yet.
- [ ] `parseGroupMatches` (line 37): Test valid, malformed, empty, and boundary input; assert exact output or error. No direct test file is linked yet.

### `src/cli/syllabus.ts`

- [ ] `option` (line 31): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).
- [ ] `notifyInteractiveSignIn` (line 41): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).

### `src/cli/transcripts.mjs`

- [ ] `getOptionValue` (line 45): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `isRecord` (line 119): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `isExpectedMeeting` (line 129): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `isStringArray` (line 152): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `hash` (line 167): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `normLookup` (line 178): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `normMatch` (line 189): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `readJson` (line 203): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `compNumbers` (line 221): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `compSourceEntries` (line 232): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `createExpectedMeetingReport` (line 242): Test successful mutation, duplicate/conflict, validation, and failed-write behavior. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `entryMatchesMeeting` (line 271): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `toMatchedSource` (line 299): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `toReportFile` (line 309): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `renderWeekBody` (line 330): Render each state; check interactions, accessibility, loading, and error behavior. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `renderTranscript` (line 344): Render each state; check interactions, accessibility, loading, and error behavior. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `fmtMetadataField` (line 364): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).
- [ ] `createSummary` (line 373): Test successful mutation, duplicate/conflict, validation, and failed-write behavior. Candidate coverage: [`tests/transcripts.test.mjs`](../tests/transcripts.test.mjs).

### `src/index.ts`

- [ ] File behavior: execute or compile this source, including expected output and failure handling. No direct test file is linked yet.

### `src/workflows/browser.ts`

- [ ] `ignoreCleanupFailure` (line 92): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `storageStateExists` (line 102): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `createDefaultWorkflowSession` (line 117): Test successful mutation, duplicate/conflict, validation, and failed-write behavior. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `resolveWorkflowStorageStatePath` (line 132): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `launchWorkflowSession` (line 150): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `closePersistentContext` (line 168): Test successful mutation, duplicate/conflict, validation, and failed-write behavior. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `closeWorkflowBrowser` (line 180): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `closeWorkflowSession` (line 200): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `withWorkflowSession` (line 217): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `saveStorageState` (line 231): Test successful mutation, duplicate/conflict, validation, and failed-write behavior. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `authenticateWorkflow` (line 246): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `open` (line 257): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `captureFailure` (line 265): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `ready` (line 272): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).
- [ ] `waitForInteractivePoll` (line 295): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/browser.test.mjs`](../tests/browser.test.mjs).

### `src/workflows/index.ts`

- [ ] File behavior: execute or compile this source, including expected output and failure handling. No direct test file is linked yet.

### `src/workflows/parallel.ts`

- [ ] `positiveInt` (line 61): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/parallel.test.mjs`](../tests/parallel.test.mjs).
- [ ] `resolveWorkerCount` (line 79): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/parallel.test.mjs`](../tests/parallel.test.mjs).
- [ ] `runQueued` (line 109): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/parallel.test.mjs`](../tests/parallel.test.mjs).
- [ ] `drainQueue` (line 126): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/parallel.test.mjs`](../tests/parallel.test.mjs).
- [ ] `compFailureIndex` (line 145): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/parallel.test.mjs`](../tests/parallel.test.mjs).
- [ ] `acquireWorkflowSlot` (line 156): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/parallel.test.mjs`](../tests/parallel.test.mjs).
- [ ] `releaseSlot` (line 188): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/parallel.test.mjs`](../tests/parallel.test.mjs).

### `src/workflows/syllabus.ts`

- [ ] `prepareAustralianSyllabusPage` (line 126): Render each state; check interactions, accessibility, loading, and error behavior. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).
- [ ] `sFileName` (line 159): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).
- [ ] `ignoreSyllabusFailure` (line 178): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).
- [ ] `compArchiveEntryNames` (line 189): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).
- [ ] `isSyllabusBodyVisible` (line 199): Test expected input/output, empty and boundary cases, and a relevant failure path. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).
- [ ] `readSyllabusBodyText` (line 213): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).
- [ ] `isAustralianSyllabusPageReady` (line 228): Render each state; check interactions, accessibility, loading, and error behavior. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).
- [ ] `fetchAustralianSyllabus` (line 242): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).
- [ ] `openSyllabusPage` (line 252): Render each state; check interactions, accessibility, loading, and error behavior. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).
- [ ] `waitForSyllabusDownload` (line 263): Test found, missing, unauthorized, and upstream-failure results. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).
- [ ] `normalizeSyllabusDocument` (line 304): Test valid, malformed, empty, and boundary input; assert exact output or error. Candidate coverage: [`tests/syllabus.test.mjs`](../tests/syllabus.test.mjs).

### `tests/browser.test.mjs`

- [ ] `callback@10` (line 10): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `createSession` (line 22): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@27` (line 27): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@28` (line 28): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `storageState` (line 37): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `close` (line 42): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `open` (line 44): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `isReady` (line 45): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `onInteractiveStart` (line 46): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@67` (line 67): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `createSession` (line 77): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `storageState` (line 77): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `close` (line 77): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `open` (line 78): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `isReady` (line 79): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@90` (line 90): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `createSession` (line 99): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `close` (line 99): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `open` (line 100): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `isReady` (line 103): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@105` (line 105): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@113` (line 113): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `storageState` (line 124): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `close` (line 128): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `newContext` (line 131): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `close` (line 135): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@137` (line 137): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `open` (line 145): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `isReady` (line 146): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.

### `tests/canvas.test.mjs`

- [ ] `canvasAnchor` (line 31): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `querySelector` (line 36): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `getAttribute` (line 36): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `getAttribute` (line 37): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `closest` (line 38): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `canvasModule` (line 47): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `querySelector` (line 49): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `querySelectorAll` (line 49): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `canvasPageFixture` (line 57): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `url` (line 62): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `goto` (line 63): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `waitForLoadState` (line 67): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `waitForURL` (line 68): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `waitForFunction` (line 71): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `evaluate` (line 72): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `locator` (line 73): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `first` (line 75): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `waitFor` (line 76): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `isVisible` (line 77): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `evaluateAll` (line 78): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `locator` (line 84): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `evaluateAll` (line 85): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `url` (line 96): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@102` (line 102): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@104` (line 104): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@117` (line 117): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `locator` (line 119): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `waitFor` (line 121): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `evaluateAll` (line 123): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `querySelector` (line 126): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `querySelectorAll` (line 127): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `closest` (line 128): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `closest` (line 129): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `closest` (line 130): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@150` (line 150): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `get` (line 158): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `ok` (line 161): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `status` (line 162): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `url` (line 163): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `headers` (line 164): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `body` (line 165): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `dispose` (line 166): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@189` (line 189): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@200` (line 200): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@218` (line 218): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@229` (line 229): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@237` (line 237): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `log` (line 255): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `createSession` (line 256): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `newPage` (line 259): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `get` (line 261): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `ok` (line 262): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `status` (line 263): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `url` (line 264): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `headers` (line 265): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `body` (line 266): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `dispose` (line 267): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `storageState` (line 270): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `close` (line 274): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.

### `tests/parallel.test.mjs`

- [ ] `resolvesWorkerOverrides` (line 15): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `runsBoundedQueueWork` (line 26): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `executeItem` (line 35): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `failureIndex` (line 60): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `releasesWorkflowSlots` (line 67): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@87` (line 87): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `runWorker` (line 110): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@111` (line 111): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@114` (line 114): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.

### `tests/syllabus.test.mjs`

- [ ] `normArchiveSelectsOneSyllabusDocument` (line 13): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@36` (line 36): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@53` (line 53): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `url` (line 57): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `goto` (line 58): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@70` (line 70): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@74` (line 74): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `isDisabled` (line 75): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `isChecked` (line 76): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `click` (line 77): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `url` (line 83): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `locator` (line 84): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `fill` (line 85): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `filter` (line 86): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `first` (line 86): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `click` (line 86): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `locator` (line 89): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `first` (line 90): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `waitFor` (line 90): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `count` (line 90): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `nth` (line 90): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `first` (line 92): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `check` (line 92): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@100` (line 100): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@100` (line 100): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@107` (line 107): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `page` (line 113): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `url` (line 113): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `locator` (line 113): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `isVisible` (line 113): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `innerText` (line 113): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@119` (line 119): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `onInteractiveStart` (line 134): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `createSession` (line 135): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `url` (line 143): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `goto` (line 149): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `locator` (line 152): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `isVisible` (line 154): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `innerText` (line 154): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `getByRole` (line 156): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `click` (line 159): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `waitForEvent` (line 161): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `suggestedFilename` (line 163): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `saveAs` (line 163): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `newPage` (line 167): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `storageState` (line 168): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `close` (line 173): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@190` (line 190): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `createSession` (line 198): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `url` (line 204): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `goto` (line 210): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `newPage` (line 214): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `close` (line 214): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.

### `tests/transcripts.test.mjs`

- [ ] `runTranscriptInventory` (line 16): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@20` (line 20): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@66` (line 66): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@77` (line 77): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.
- [ ] `callback@87` (line 87): Run this test and verify its assertions cover the helper, failure path, and relevant fixture. No direct test file is linked yet.

## Document inventory

- [ ] [`.changeset/repository-structure.md`](../.changeset/repository-structure.md): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`CHANGELOG.md`](../CHANGELOG.md): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`README.md`](../README.md): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/01-getting-started/01-overview.mdx`](../config/docs/01-scraping/01-getting-started/01-overview.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/01-getting-started/index.mdx`](../config/docs/01-scraping/01-getting-started/index.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/02-guides/01-browser-sessions.mdx`](../config/docs/01-scraping/02-guides/01-browser-sessions.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/02-guides/02-parallel-work.mdx`](../config/docs/01-scraping/02-guides/02-parallel-work.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/02-guides/03-canvas-export.mdx`](../config/docs/01-scraping/02-guides/03-canvas-export.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/02-guides/04-australian-syllabus.mdx`](../config/docs/01-scraping/02-guides/04-australian-syllabus.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/02-guides/05-transcript-inventory.mdx`](../config/docs/01-scraping/02-guides/05-transcript-inventory.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/02-guides/index.mdx`](../config/docs/01-scraping/02-guides/index.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/03-reference/01-canvas.mdx`](../config/docs/01-scraping/03-reference/01-canvas.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/03-reference/02-workflows.mdx`](../config/docs/01-scraping/03-reference/02-workflows.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/03-reference/03-command-line.mdx`](../config/docs/01-scraping/03-reference/03-command-line.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/03-reference/index.mdx`](../config/docs/01-scraping/03-reference/index.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/04-maintenance/01-quality-and-release.mdx`](../config/docs/01-scraping/04-maintenance/01-quality-and-release.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`config/docs/01-scraping/04-maintenance/index.mdx`](../config/docs/01-scraping/04-maintenance/index.mdx): Render, check links and examples, then review each factual claim and instruction against the current implementation.
- [ ] [`docs/README.md`](../docs/README.md): Render, check links and examples, then review each factual claim and instruction against the current implementation.

## Configuration and other owned files

- [ ] `.changeset/config.json`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `.github/workflows/check.yml`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `.gitignore`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `LICENSE`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `config/.prettierrc.json`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `config/husky/pre-commit`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `config/knip.json`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `config/package.json`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `config/patches/@terra-symposium__docs@0.4.3.patch`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `config/patches/@terra-symposium__standards-quality@2.2.0.patch`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `config/pnpm-lock.yaml`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `config/pnpm-workspace.yaml`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `config/quality.json`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `config/tsconfig.json`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `package.json`: validate syntax or schema, exercise its owning tool, and check references to this file.
- [ ] `pnpm-lock.yaml`: validate syntax or schema, exercise its owning tool, and check references to this file.

Inventory: 249 function-like declarations, 18 documents, 16 other owned files, and 18 executable source files.
