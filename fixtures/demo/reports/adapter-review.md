# Adapter verification

Assessment: verified when recorded. Assignment accepted by the lead.

## Checks observed

- Read-only polling uses `herdr api snapshot` with a 2.5 second timeout.
- An idle worker remains awaiting verification without an explicit resolution.
- Evidence receipts bind the recorded bytes with SHA-256.

## Remaining boundaries

This assignment decision does not accept the entire project or release.
