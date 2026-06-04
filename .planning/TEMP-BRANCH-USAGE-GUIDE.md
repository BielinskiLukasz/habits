# Using Temp Branch Work

**Created:** 2026-06-05  
**Temp branch:** `c449c5b` ("backup")  
**Status:** Ready for reuse

## Quick Summary

The `temp` branch contains ~3500 lines of Phase 4 implementation:
- **Core logic**: `mastery.js`, `stage.js`, `waveAggregates.js`, date utilities
- **Tests**: 40+ unit and integration tests (2200+ lines)
- **View builders**: Catalog, history, today builders

See `.planning/TEMP-BRANCH-REFERENCE.md` for full file inventory.

## How to Integrate

### Option 0: Executor Reads and Reuses (RECOMMENDED for execute-phase)

**If running `/gsd-execute-phase 4`:**

The executor agent will automatically read the temp branch code and adapt it into fresh commits. You don't need to do anything—just run execute-phase. The executor will:

1. View modules via `git show temp:js/domain/mastery.js`
2. Understand the logic and test patterns
3. Implement each module in the current branch with fresh commits
4. **Result:** Clean commit history + reused proven code

See `.planning/TEMP-BRANCH-REFERENCE.md` section "RECOMMENDED: Executor Reads and Reuses" for full executor instructions.

### Option 1: Cherry-pick Individual Modules (Manual, Not Recommended)

This is the safest approach. You can pull in modules one by one, test them, commit them:

```bash
# Import a single module from temp branch
git checkout temp -- js/domain/mastery.js
git add js/domain/mastery.js
git commit -m "feat(04): import mastery evaluator from temp branch"

# Import its tests
git checkout temp -- tests/unit/mastery.test.js
git add tests/unit/mastery.test.js
git commit -m "test(04): import mastery tests from temp branch"

# Run tests to verify
npm test
```

Repeat for other modules:
- `js/domain/stage.js` + `tests/unit/stage.test.js`
- `js/domain/waveAggregates.js` + `tests/unit/waveAggregates.test.js`
- `js/util/date.js` + `tests/unit/date.test.js`
- Integration tests as desired

### Option 2: Pull Planning Summaries Only

If you want to reuse the high-level structure without the code:

```bash
# Get the Phase 4 summaries (helpful for understanding wave breakdown)
git checkout temp -- .planning/04-00-SUMMARY.md
git checkout temp -- .planning/04-01-SUMMARY.md
git checkout temp -- .planning/04-02-SUMMARY.md
git checkout temp -- .planning/04-03-SUMMARY.md
git checkout temp -- .planning/04-04-SUMMARY.md
```

These are pure documentation; they show how the 5 waves decompose.

### Option 3: Use as Reference Only (No Merge)

If you'd rather re-implement from scratch:

```bash
# Keep the reference file in .planning/
# Read the temp branch commits via:
git log --oneline temp
git diff main..temp -- js/domain/mastery.js  # See what changed
git show temp:js/domain/mastery.js  # Read the final code
```

## When to Use Each Option

| Scenario | Option | Reasoning |
|----------|--------|-----------|
| Running `/gsd-execute-phase 4` | **0** | Executor reads and reuses temp code, creates clean commits—best of both worlds |
| You want to understand the wave breakdown before planning | 2 | Summaries are self-contained; no code overhead |
| You want to manually integrate before execute-phase | 1 | Cherry-pick individual modules and test (but brings messy history) |
| You want to rewrite it yourself / learn from scratch | 3 | Keep the reference, use git diff/show as guides |

## Conflict Resolution

If cherry-picking modules causes merge conflicts:

```bash
# Abort the checkout and try a different approach
git checkout --ours js/domain/mastery.js
git add js/domain/mastery.js

# Or start fresh (reset and cherry-pick only what's needed)
git reset --hard main
git checkout temp -- js/domain/mastery.js
```

## Cleanup After Use

Once you've merged or cherry-picked the work you need:

```bash
# Delete the reference files when done
rm .planning/TEMP-BRANCH-REFERENCE.md
rm .planning/TEMP-BRANCH-USAGE-GUIDE.md

# Delete the temp branch if it's no longer needed
git branch -D temp

# Commit the cleanup
git add .planning/STATE.md
git commit -m "cleanup: remove temp branch references after integration"
```

## Test Suite Status

The temp branch includes 40+ tests across:

- **Unit tests**: Pure function testing (no IDB)
  - `mastery.test.js` (678 lines, comprehensive)
  - `stage.test.js` (442 lines, edge cases)
  - `waveAggregates.test.js` (511 lines)
  - `date.test.js` (91 lines)
  - `cadence.test.js` (181 new lines)

- **Integration tests**: Cross-module flows
  - `mastery-cadence.test.js` (237 lines)
  - Others for stage, wave aggregates, catalog/history flows

All tests use `node --test` (no external runner). Verify with:

```bash
npm test  # After cherry-picking
```

## Known State of Temp Branch Code

The temp branch code:
- ✓ All modules use JSDoc per D-27 (file headers + exported APIs)
- ✓ Tests follow D-23..D-26 conventions (node --test, fake IDB helpers)
- ✓ No external dependencies (no npm imports)
- ✓ Follows the existing module structure (`js/domain/`, `js/util/`, `tests/unit/`, `tests/integration/`)

The code is **ready to integrate**. No refactoring or cleanup needed.

## Using With execute-phase (Recommended)

When you run `/gsd-execute-phase 4`:

1. **Planner reads** `.planning/TEMP-BRANCH-REFERENCE.md` and understands the module structure + test coverage
2. **Planner creates tasks** with references to temp branch implementations (e.g., "Implement mastery.js using temp as reference")
3. **Executor reads the temp code** via `git show temp:js/domain/mastery.js`, understands the logic and design patterns
4. **Executor implements fresh commits** in main branch with the same logic
5. **Result:** Clean Phase 4 commits that reuse proven code, no tangled history

**This is the recommended approach.** Just run `/gsd-execute-phase 4`—the executor handles code reading and reuse automatically.

---

For questions or issues, refer to `.planning/TEMP-BRANCH-REFERENCE.md` or inspect the temp branch directly:

```bash
git log --oneline temp | head -20
git show temp
```
