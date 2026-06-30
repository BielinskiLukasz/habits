# Phase 7: Scheduled Status Foundation - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 5 (1 new, 4 modified)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `js/domain/scheduled.js` | domain service | batch (boot-time mutation) | `js/domain/wave.js` + `js/io/seed.js` | role-match (DI + boot fn) + data-match (meta guard) |
| `js/state/apply/createHabit.js` | apply handler | request-response | self (existing file, 1-line fix) | exact |
| `js/main.js` | shell entry | boot sequence | self (existing file, 2-line addition) | exact |
| `js/desktop.js` | shell entry | boot sequence | `js/main.js` | exact |
| `scripts/convert-nawyki.js` | utility script | batch transform | self (existing file, 1-line fix) | exact |

---

## Pattern Assignments

### `js/domain/scheduled.js` (NEW — domain service, batch)

**Primary analog:** `js/domain/wave.js` (DI pattern: `configure*` + `boot*`)
**Secondary analog:** `js/io/seed.js` (meta one-time guard, `repo.runTx` direct writes)

**DI pattern — module-level mutable + configure function** (`js/domain/wave.js` lines 31–49):
```js
/** @type {object|null} */
let _repo = null;

/**
 * Inject dependencies.
 *
 * @param {{ repo?: object }} deps
 * @returns {void}
 */
export function configureScheduled(deps) {
  if (deps.repo) _repo = deps.repo;
}
```
(Shape from `seed.js` lines 64–89; truthy-field overwrite pattern.)

**Boot function shape** (`js/domain/wave.js` lines 58–74):
```js
/**
 * Run migration + promotion on every boot. Safe to call repeatedly.
 *
 * @returns {Promise<void>}
 */
export async function bootScheduled() {
  if (!_repo) throw new Error('scheduled: configureScheduled({repo}) not called');
  await runMigration();
  await runPromotion();
}
```

**Meta one-time guard pattern** (`js/io/seed.js` lines 107–111, 176, 198–201):
```js
// Fast-path: check meta key first
const migrationDone = await _repo.getMeta('scheduledMigrationV1');
if (migrationDone !== undefined) return;

// ... perform migration work ...

// Write guard atomically with data changes in the same tx
tx.objectStore('meta').put({ key: 'scheduledMigrationV1', value: true });
```

**Direct `repo.runTx` write (bypassing apply.js)** (`js/io/seed.js` lines 159–184):
```js
await repo.runTx(
  ['habits', 'meta'],
  'readwrite',
  async (tx) => {
    // cursor-based reads and puts here
    tx.objectStore('meta').put({ key: 'scheduledMigrationV1', value: true });
  },
);
```

**JSDoc file header** (`js/domain/wave.js` lines 1–28):
```js
/**
 * @file <one-line summary>. <rationale + cross-references to D-XX decisions>
 *
 * <Lifecycle description paragraph>
 *
 * Configure-based DI:
 *   - `configureScheduled({repo})` injects the repo handle; production passes
 *     the real repo once at boot. Tests inject fakes via the same hook.
 *
 * Forbidden constructs in this file:
 *   - Direct `js/db/repo.js` write helpers — all writes go through `repo.runTx`.
 *   - `.innerHTML` family — D-78 grep gate covers this file too.
 */
```

---

### `js/state/apply/createHabit.js` (MODIFY — apply handler, request-response)

**Analog:** self (existing file)

**Current hardcoded status** (line 86):
```js
status: 'active',
```

**Target pattern** — derive from `startDate` using existing `todayLocal()` import (lines 32–33 show it is already imported):
```js
import { todayLocal } from '../../util/date.js';
// ...
const sd = startDate ?? todayLocal();
// ...
status: sd > todayLocal() ? 'scheduled' : 'active',
```
`todayLocal` is already imported at line 33. `sd` is already computed at line 78. The change is a single expression replacing `'active'` at line 86.

---

### `js/main.js` (MODIFY — shell entry, boot sequence)

**Analog:** self (existing file); `js/desktop.js` mirrors same structure.

**Configure block insertion point** (lines 85–99 show all existing `configure*` calls):
```js
configureApply({ repo, broadcast, trackTx, onLogWrite: ... });
configureUndo({ repo });
configureSeed({ repo, storage: navigator.storage, fetch: globalThis.fetch });
configureWave({ fetch: globalThis.fetch });
configureStore({ repo });
// ADD: configureScheduled({ repo });
```

**Boot sequence insertion point** (lines 102–111):
```js
try { await bootSeed(); } catch (_e) { /* swallow */ }
// ADD: try { await bootScheduled(); } catch (_e) { /* swallow */ }
try { await hydrate(); } catch (_e) { /* swallow */ }
```

**Import addition** (alongside existing domain imports at line 71):
```js
import { configureScheduled, bootScheduled } from './domain/scheduled.js';
```

---

### `js/desktop.js` (MODIFY — shell entry, boot sequence)

**Analog:** `js/main.js` (identical pattern; desktop already mirrors mobile boot structure exactly).

Same three additions as `main.js`:
1. Import `configureScheduled, bootScheduled` from `./domain/scheduled.js` alongside existing domain imports (line 58).
2. Add `configureScheduled({ repo })` in the P2 configure block (after line 86 `configureUndo`).
3. Add `try { await bootScheduled(); } catch (_e) {}` after `bootSeed()` (after line 89), before `hydrate()` (line 90).

---

### `scripts/convert-nawyki.js` (MODIFY — utility script, batch transform)

**Analog:** self (existing file)

**Current line** (line 278):
```js
status: 'active',
```

**Target pattern** — compare `startDate` (already in scope at this point in the loop) against today's ISO date string:
```js
const TODAY = new Date().toISOString().slice(0, 10);
// ... (define TODAY near top of file or inline in the expression)
status: startDate > TODAY ? 'scheduled' : 'active',
```
`startDate` is already a local variable in scope at line 278 (assigned earlier in the same loop body). `TODAY` should be computed once before the loop.

---

## Shared Patterns

### DI configure function (truthy-field overwrite)
**Source:** `js/io/seed.js` lines 85–89
**Apply to:** `js/domain/scheduled.js`
```js
export function configureSeed(deps) {
  if (deps.repo) _repo = deps.repo;
  if (deps.storage) _storage = deps.storage;
  if (deps.fetch) _fetch = deps.fetch;
}
```
Use same shape: `if (deps.repo) _repo = deps.repo;`

### Meta one-time guard
**Source:** `js/io/seed.js` lines 107–111
**Apply to:** `runMigration()` in `js/domain/scheduled.js`
```js
const seededIds = await repo.getMeta('seededIds');
const persistResult = await repo.getMeta('persistResult');
if (seededIds !== undefined && persistResult !== undefined) {
  return;
}
```
Mirror: `const migrationDone = await _repo.getMeta('scheduledMigrationV1'); if (migrationDone !== undefined) return;`

### Swallowed try/catch for boot functions
**Source:** `js/main.js` lines 102–103 and `js/desktop.js` lines 89–90
**Apply to:** `bootScheduled()` call in both shells
```js
try { await bootSeed(); } catch (_e) { /* swallow */ }
try { await hydrate(); } catch (_e) { /* swallow */ }
```

### `todayLocal()` for ISO date comparisons
**Source:** `js/util/date.js` (imported in `js/state/apply/createHabit.js` line 33)
**Apply to:** `js/domain/scheduled.js` (`runMigration`, `runPromotion`), `js/state/apply/createHabit.js` (status derivation)
```js
import { todayLocal } from '../../util/date.js';
// or relative path from domain/:
import { todayLocal } from '../util/date.js';
```

---

## No Analog Found

None — all files have close analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `js/domain/`, `js/io/`, `js/state/apply/`, `js/main.js`, `js/desktop.js`, `scripts/`
**Files scanned:** 8 source files read in full
**Pattern extraction date:** 2026-07-01
