# 0003 — Source-installable npm executable

Status: accepted

Date: 2026-10-14

## Context

Sharing the repository needs both a documented local build and a launch command without a user-managed clone. The source CLI runs through the development-only tsx loader. A package installed into npm's execution cache cannot depend on that loader or on files excluded from its package.

## Decision

Compile production TypeScript into gitignored dist/ with the existing TypeScript compiler. Expose a small Node executable that calls the compiled CLI. Keep UI and demo fixture paths relative to the installed package root. Include compiled modules, the executable, the UI, and demo fixtures in the npm package; exclude tests, reports from actual sessions, screenshots, and agent metadata. Run the build in npm's prepare lifecycle for local packing and Git source installs. Document npm exec with the explicit GitHub package specifier, so no npm registry publication or global install is needed.

## Consequences

Users can build locally or ask npm to fetch, prepare, and run the source package in its cache. The GitHub form needs the repository to be accessible and the existing Git/Node/Swift toolchain. Source installs build with development dependencies; the prepared runtime only needs production dependencies. Generated JavaScript remains uncommitted. Packaging tests must execute from outside the source tree and verify that presentation and fixture assets resolve there. A Git ref can pin the source revision for repeatable launches.

Sources: [npm exec](https://docs.npmjs.com/cli/v11/commands/npm-exec/), [npm scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/).
