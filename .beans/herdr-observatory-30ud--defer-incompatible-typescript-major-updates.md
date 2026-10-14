---
# herdr-observatory-30ud
title: Defer incompatible TypeScript major updates
status: completed
type: task
priority: normal
created_at: 2026-10-14T06:19:03Z
updated_at: 2026-10-14T06:20:35Z
---

Initial Dependabot scan failed because TypeScript 7 exceeds typescript-eslint 8.71.2 peer range (<6.1). Preserve compatible TypeScript 6 while keeping patch/minor updates enabled; watch replacement scan.



## Summary of Changes

Deferred only TypeScript major version updates in Dependabot while typescript-eslint requires <6.1.0; patch and minor update checks remain enabled. The replacement scan https://github.com/gAmUssA/herdr-observatory/actions/runs/38521527929 completed successfully at config commit 197cac3. Follow-up herdr-observatory-3nfh tracks removal of the deferral when a compatible paired toolchain is verified.
