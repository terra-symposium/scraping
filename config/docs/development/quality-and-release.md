---
title: Quality and releases
description: Run the configured checks, build the Docs site, and release a reviewed package tag.
---

# Quality and releases

## Repository checks

From the repository root, run the configured quality wrapper:

    pnpm run quality

The wrapper runs formatting, dead-code analysis, lint, source analysis, React error-boundary checks, imports, naming, aliases, forwarding, documentation, the package build, the Docs build, and repository-diff validation. No standalone test suite is configured. Run `pnpm run build` to build only the TypeScript package or `pnpm --dir config run build` to build the Docs site.

The Docs application and quality tools have their own dependencies under `config/`. Run `pnpm --dir config run docs` to serve the site at `http://127.0.0.1:2060/`.

## Release a package tag

1. Update the package version in the root `package.json`.
2. Run `pnpm run quality` and review the package and Docs changes.
3. Commit the release change and create a matching `vX.Y.Z` Git tag.
4. Push the branch and tag to `Terra-Symposium/scraping`.
5. Update the Website and Uni Notes Git dependency pins and lockfiles.

Consumers install the package from Git; no npm publish or hosted Docs deployment is configured. Keep the tag and package version aligned so each consumer lockfile can resolve the intended release.
