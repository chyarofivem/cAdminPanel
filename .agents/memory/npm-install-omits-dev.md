---
name: npm-install-omits-dev
description: On the maintainer's workstation a plain npm ci skips all dev dependencies and then fails on husky; install with --include=dev --ignore-scripts.
metadata:
  type: project
---

On 2026-11-15 `node_modules` was absent, and `npm.cmd ci` installed only the ~600 production
packages (vitest, esbuild, rimraf, commitlint, husky and the NUI's dev-only packages were all
missing), then failed in the root `prepare` script with "'husky' is not recognized". `npm config`
showed `omit = []`, so the cause was not found; it behaves as if NODE_ENV were production.

**Why:** A half-installed tree passes some commands and fails others in confusing ways, and
`husky install` would also rewrite `core.hooksPath` in the git config.

**How to apply:** Install with `npm.cmd ci --include=dev --ignore-scripts`, then confirm
`node_modules/vitest/package.json` exists before running tests, typechecks or builds. Skipping
scripts is safe: esbuild resolves its platform binary package at runtime. See also
[[git-push-needs-no-verify]].
