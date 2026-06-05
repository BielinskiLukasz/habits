---
name: phase6_qa_insert
description: Manual QA session between phase 5 and phase 6 — author tests, GSD creates new phase based on findings
metadata:
  type: project
---

## Workflow

After phase 5 completes:

1. **Author manually tests the app** — note gaps and issues.
2. **Author reviews BACKLOG.md** — correlate manual test findings with backlog items.
3. **GSD framework creates new phase 6** — based on the most important gaps/errors.
4. **Old phase 6 becomes phase 7** — everything shifts down.

## Why

Manual testing surfaces real user-facing issues that static testing (unit, integration) cannot catch: UI latency, mobile usability friction, edge-case interactions, accessibility gaps. Correlating these with BACKLOG ensures the new phase addresses high-impact issues.

## How to Apply

After phase 5 execution completes, do not begin (old) phase 6. Instead:
- Run the app manually on mobile and desktop.
- Document gaps/errors in a test session note.
- Share findings with GSD to plan the new phase 6.
