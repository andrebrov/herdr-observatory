# Observatory design review

A calm interface for reviewing **evidence**, _observations_, and `acceptance` separately.

## Verification status

| Check           | Observation          |   Assessment    |
| :-------------- | :------------------- | :-------------: |
| Local adapter   | Read-only snapshots  |  **Verified**   |
| Dashboard       | Report delivered     | Awaiting review |
| Session history | Retention unresolved |     Blocked     |

> A report is evidence to assess. Its existence alone does not establish acceptance.

## Review checklist

- [x] Separate live activity from acceptance
- [x] Preserve keyboard focus during refresh
- [ ] Record the lead's design assessment

## Evidence references

Inspect the [test results](test-results.txt). The [external design reference](https://example.com/design) remains a text reference.

```typescript
const accepted =
  resolution.outcome === "accepted" &&
  evidence.every((receipt) => receipt.integrity === "matched");
```

## Recommendations

1. Keep the board's hierarchy clear.
   - Use restrained **color** and readable spacing.
   - Keep provenance close to each claim.
2. Keep unanswered questions visible.

## Open question

Should historical sessions be retained for 7 or 30 days?

<script>window.__unsafeReportExecuted = true</script>

The script above is deliberate untrusted fixture text. It must never execute.

![Untrusted remote image](https://example.com/tracking-pixel.png)
