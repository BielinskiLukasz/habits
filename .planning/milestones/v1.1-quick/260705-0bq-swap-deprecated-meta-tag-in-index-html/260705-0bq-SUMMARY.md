---
quick_id: 260705-0bq
status: complete
date: 2026-07-04
commit: 033cafc
---

# Quick Task 260705-0bq: Summary

## What was done

Removed the deprecated `<meta name="apple-mobile-web-app-capable" content="yes">` tag from both `index.html` and `desktop.html`.

The manifest already declares `"display": "standalone"`, which is the modern replacement for this tag. Apple deprecated `apple-mobile-web-app-capable` in Safari 17 (2023).

## Files changed

- `index.html` — line 9 removed
- `desktop.html` — line 9 removed

## Commit

`033cafc` — fix(meta): remove deprecated apple-mobile-web-app-capable tag
