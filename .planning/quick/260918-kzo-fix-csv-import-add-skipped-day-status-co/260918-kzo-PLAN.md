---
phase: quick-260918-kzo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - data/convert-csv-to-import-2026-09-18.mjs
  - data/habits-import-2026-09-18.json
autonomous: true
requirements:
  - HABITS-IMPORT-SKIPPED-260918

estimate:
  tokens: 22000
  raw_tokens: 22000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - Running the new converter emits a log row with status:'skipped' for every day whose Nawyki v2.csv cell value is exactly 's' within the tracked date range — the bug being fixed (the 09-17 converter only recognized '1'/'0' and silently dropped 's' days entirely)
    - Every habit row in Nawyki v2.csv matches a catalog habit from the 09-17 import — 0 unmatched rows, all 66 habits present in the output
    - Cells with 'x', 'n', or '' produce no log row (not applicable / not yet started, correctly excluded from logs)
    - Any cell value outside the known set ('1','0','s','x','n','') triggers a console.warn identifying the row/date and is skipped, never crashing the script or silently corrupting output
    - Every log row in the generated output carries status:'completed'|'failed'|'skipped' directly (no completed:boolean field), matching what js/io/import.js accepts natively for the current 4-state model
    - Existing files (data/convert-csv-to-import-2026-09-17.mjs, data/habits-import-2026-09-17.json, data/Nawyki v1.csv) are left byte-identical to their pre-task state
  artifacts:
    - data/convert-csv-to-import-2026-09-18.mjs (new converter script)
    - data/habits-import-2026-09-18.json (new import file: schemaVersion 1, 66 habits, logs with completed/failed/skipped status breakdown reported)
  key_links:
    - Converter loads data/habits-import-2026-09-17.json (not a raw CSV-derived export) as the habit catalog, reusing its 66 already-resolved habit records (English names, UUIDs, startDate, name_pl) verbatim and unmodified
    - Date-column discovery scans the full Nawyki v2.csv header row generically via /^\d{4}-\d{2}-\d{2}$/ rather than hardcoding the known 8..378 index range, so a future column shift in the sheet doesn't silently break the importer
    - Per-cell status mapping ('1'→completed, '0'→failed, 's'→skipped, 'x'/'n'/''→no row, else→warn+skip) is the single chokepoint fixing the original bug where 's' cells were silently dropped instead of becoming skipped logs
---

<objective>
Fix the CSV importer's skipped-day bug and regenerate the habits import JSON for TODAY=2026-09-18
by writing a new one-off converter, `data/convert-csv-to-import-2026-09-18.mjs`, that reuses
`data/habits-import-2026-09-17.json` as the habit catalog and parses the cleaned
`data/Nawyki v2.csv` with full support for all five day-cell status codes (`1`/`0`/`s`/`x`/`n`),
instead of the prior converter's `1`/`0`-only logic that silently dropped every skipped ('s') day.

Purpose: Produce a correct, up-to-date IndexedDB import file the user can load into the app
(Settings → Import) that faithfully represents every logged day — including skipped days, which
were previously lost on import — through 2026-09-18, without disturbing the historical 09-17
artifacts.
Output: `data/convert-csv-to-import-2026-09-18.mjs` (new script) and
`data/habits-import-2026-09-18.json` (new import file).
</objective>

<execution_context>
@C:/my-code/vibe-coding/habits/.claude/gsd-core/workflows/execute-plan.md
@C:/my-code/vibe-coding/habits/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@C:/my-code/vibe-coding/habits/.planning/STATE.md
@C:/my-code/vibe-coding/habits/CLAUDE.md
@C:/my-code/vibe-coding/habits/data/convert-csv-to-import-2026-09-17.mjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write the 2026-09-18 converter script with skipped-day support</name>
  <files>data/convert-csv-to-import-2026-09-18.mjs</files>
  <action>
Create a new file `data/convert-csv-to-import-2026-09-18.mjs` (do NOT edit
`data/convert-csv-to-import-2026-09-17.mjs` — it is a historical artifact). Start from the same
overall shape as `data/convert-csv-to-import-2026-09-17.mjs` (already in context) — reuse its
`parseCSV`/`parseRow` quoted-field-aware CSV parser and its `normSkeleton` name-normalization
function verbatim, and reuse its `MANUAL_MAP` object verbatim (all 33 entries, keyed by CSV
column-0 ID, valued as an English name prefix) — the CSV row IDs are unchanged across the 09-17
and 09-18 exports, so the same map resolves the same encoding-ambiguous Polish names.

Four things differ from the 09-17 script:

1. Catalog source. Load `data/habits-import-2026-09-17.json` (the immediately-prior import, not
   the raw CSV or an earlier catalog) via
   `JSON.parse(readFileSync(new URL('./habits-import-2026-09-17.json', import.meta.url), 'utf8'))`.
   Use its `habits` array directly as `realHabits` — every entry already carries a `startDate`, no
   filtering needed. Build `byNamePl` (keyed by `normSkeleton(h.name_pl ?? '')`) and `byEnglish`
   (keyed by `h.name`) lookup maps from this array, exactly as the 09-17 script does.

2. Input CSV and TODAY constant. Read `data/Nawyki v2.csv` (not `Nawyki v1.csv`), windows-1250
   decoded via `TextDecoder`, exactly as the prior script decodes its CSV. Set
   `const TODAY = '2026-09-18';`.

3. Date-column discovery — generic, not index-hardcoded. `Nawyki v2.csv`'s header row has one
   clean contiguous run of date-shaped headers from `2025-12-29` through `2027-01-03`, with no
   duplicate block (columns after that run have empty headers — footnote overflow — and must be
   excluded). Do NOT hardcode the known 8..378 index range. Instead, exactly as the 09-17 script
   already does: scan the ENTIRE header row (`rows[0]`) once, building an array of `{ i, d }` pairs
   (`i` = the header's absolute index, `d` = the header string) for every header matching
   `/^\d{4}-\d{2}-\d{2}$/`. Filter that array to entries where `d <= TODAY`, producing
   `activeDateCols`. When extracting logs for a matched row, iterate `activeDateCols` and read
   `row[i]` (the pair's absolute column index) directly.

4. Per-cell status mapping — the actual bug fix. Within columns whose header is `<= TODAY`, the
   only cell values that occur are `''`, `'1'`, `'0'`, `'s'`, `'n'`, `'x'`. Replace the 09-17
   script's `completed: true`/`completed: false`-only branch with this mapping, reading
   `val = (row[i] ?? '').trim()` for each `{ i, d }` in `activeDateCols`:
   - `val === '1'` -> push `{ habitId: habit.id, date: d, status: 'completed', definitionVersion: null }`
   - `val === '0'` -> push `{ habitId: habit.id, date: d, status: 'failed', definitionVersion: null }`
   - `val === 's'` -> push `{ habitId: habit.id, date: d, status: 'skipped', definitionVersion: null }`
   - `val === 'x'`, `val === 'n'`, or `val === ''` -> no log row (not applicable / not yet started)
   - any other value -> `console.warn` identifying the habit, date, and the unexpected raw value,
     then skip (no log row) — do not throw, do not write a row for it

   Note the log rows now carry `status: string` directly, NOT the 09-17 script's
   `completed: boolean` field — `skipped` cannot be expressed as a boolean, and `js/io/import.js`
   already accepts a `status` field on log rows natively (its `completed` back-compat branch only
   exists for pre-4-state legacy exports).

Row-processing loop and match precedence are otherwise identical to the 09-17 script: for rows
1..end of the parsed CSV, read `csvId = row[0]?.trim()`, skip if empty or `'-99'`; read
`namePl = row[3]?.trim() ?? ''`, skip if empty. Match: (a) if `MANUAL_MAP[csvId]` exists, resolve
via `findByEnglishPrefix` against `byEnglish`; (b) otherwise fall back to
`byNamePl.get(normSkeleton(namePl))`. If neither matches, push `{ row, csvId, namePl }` to an
`unmatched` array and continue. If the resolved habit's `id` is already in a `seen` Set, warn and
skip (duplicate-match guard). Otherwise add to `seen`, push the exact habit object (unmodified) to
the output `habits` array, then apply the per-cell mapping above across `activeDateCols`.

After the loop: if `unmatched.length > 0`, `console.warn` each entry (row number, CSV id, name,
`normSkeleton` output). Always `console.log` a summary line with CSV row count, matched count, and
unmatched count, PLUS a breakdown of `logs` by status (count of `completed`, `failed`, `skipped`)
so the user can sanity-check totals against their CSV.

Write the output object — `{ schemaVersion: 1, habits, habit_versions: [], logs, events: [],
settings: [], meta: [], score_snapshots: [] }` — to `data/habits-import-2026-09-18.json` via
`writeFileSync(new URL('./habits-import-2026-09-18.json', import.meta.url), JSON.stringify(output, null, 2), 'utf8')`.

Add a JSDoc file header per D-27 (`/** @file <one-line summary>. <rationale> */`) naming the
skipped-day bug being fixed.
  </action>
  <verify>
    <automated>node --check data/convert-csv-to-import-2026-09-18.mjs &amp;&amp; git status --porcelain data/convert-csv-to-import-2026-09-17.mjs data/habits-import-2026-09-17.json "data/Nawyki v1.csv"</automated>
  </verify>
  <done>
    `data/convert-csv-to-import-2026-09-18.mjs` exists, passes `node --check` with no syntax
    errors, and `git status --porcelain` reports no changes to
    `data/convert-csv-to-import-2026-09-17.mjs`, `data/habits-import-2026-09-17.json`, or
    `data/Nawyki v1.csv` (empty output for those three paths).
  </done>
</task>

<task type="auto">
  <name>Task 2: Run the converter and validate the generated import file</name>
  <files>data/habits-import-2026-09-18.json</files>
  <action>
Run `node data/convert-csv-to-import-2026-09-18.mjs` from the repo root and capture stdout. Confirm
the printed summary reports exactly 66 CSV rows matched and 0 unmatched — if unmatched &gt; 0, the
reported rows must be investigated (most likely a `MANUAL_MAP` entry needs adjusting) before
proceeding; do not ship a file with unmatched habits silently dropped. Confirm the printed
status breakdown (completed/failed/skipped counts) is present and that the skipped count is
greater than 0 (Nawyki v2.csv is known to contain 's' cells — a zero skipped count means the
per-cell mapping in Task 1 did not fire and the bug is not actually fixed).

Then validate the generated `data/habits-import-2026-09-18.json` programmatically: it must have
`schemaVersion: 1`; its `habits` array must contain exactly 66 entries whose `id` values are the
same 66 ids present in `data/habits-import-2026-09-17.json`'s `habits` array (same set, nothing
added or removed, objects unmodified); its `logs` array must contain no date after TODAY
(`2026-09-18`); every log row's `status` must be one of `'completed'`, `'failed'`, `'skipped'`
(no `completed: boolean` field anywhere in `logs`); and the sum of the three status-count buckets
must equal `logs.length` exactly. Report the final completed/failed/skipped counts so the user can
sanity-check against their CSV.
  </action>
  <verify>
    <automated>node data/convert-csv-to-import-2026-09-18.mjs &amp;&amp; node -e "const c=require('./data/habits-import-2026-09-17.json');const o=require('./data/habits-import-2026-09-18.json');const cid=new Set(c.habits.map(h=&gt;h.id));const oid=new Set(o.habits.map(h=&gt;h.id));const idSetMatch=cid.size===66&amp;&amp;oid.size===66&amp;&amp;[...cid].every(id=&gt;oid.has(id));const statuses=new Set(o.logs.map(l=&gt;l.status));const noBoolean=o.logs.every(l=&gt;!('completed' in l));const noFuture=o.logs.every(l=&gt;l.date&lt;='2026-09-18');const counts={completed:0,failed:0,skipped:0};for(const l of o.logs){if(counts[l.status]!==undefined)counts[l.status]++;}const sumMatches=counts.completed+counts.failed+counts.skipped===o.logs.length;const ok=idSetMatch&amp;&amp;o.schemaVersion===1&amp;&amp;noBoolean&amp;&amp;noFuture&amp;&amp;sumMatches&amp;&amp;counts.skipped&gt;0&amp;&amp;[...statuses].every(s=&gt;['completed','failed','skipped'].includes(s));console.log(JSON.stringify({habits:o.habits.length,logs:o.logs.length,counts,idSetMatch,noBoolean,noFuture,ok}));process.exit(ok?0:1);"</automated>
  </verify>
  <done>
    stdout from the converter run reports 66 matched, 0 unmatched, and a completed/failed/skipped
    status breakdown with skipped &gt; 0. The validation one-liner prints an object with `ok: true`
    (habits: 66, idSetMatch: true, noBoolean: true, noFuture: true, counts summing to logs.length,
    counts.skipped &gt; 0) and exits 0. `data/habits-import-2026-09-18.json` exists on disk in the
    `{ schemaVersion, habits, habit_versions: [], logs, events: [], settings: [], meta: [],
    score_snapshots: [] }` shape, with every log carrying `status` (never `completed: boolean`).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Local file read (CSV + JSON) | Both inputs are local repo files under the user's own control, not attacker-supplied or fetched over the network |
| Generated JSON written to disk | Consumed later by the app's own JSON import (merge-by-id); no code execution path from this data |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-kzo-01 | Tampering | CSV cell values outside the known set ('1','0','s','x','n','') | low | accept | Converter emits a log row only for exact string equality to '1'/'0'/'s'; any other value triggers console.warn and is skipped, never coerced into a log |
| T-kzo-02 | Information Disclosure | `data/habits-import-2026-09-18.json` contains personal habit-completion history | low | accept | Output stays local in the repo's gitignored `data/` directory, matching how prior import files are already handled; no network calls, no telemetry (project-wide privacy constraint) |
| T-kzo-03 | Repudiation | Silent data loss if a CSV row fails to match a catalog habit, or if the skipped-day mapping regresses | medium | mitigate | Task 2's verify step hard-fails unless unmatched===0 AND skipped-count &gt; 0; unmatched rows are also printed to stdout with row/ID/name for manual review |
| T-kzo-04 | Tampering | Date-column discovery reading a stale/shifted column index if the CSV layout changes again | low | mitigate | Date columns are discovered generically via `/^\d{4}-\d{2}-\d{2}$/` header matching (never a hardcoded index range), so a future column shift cannot silently misalign dates |
</threat_model>

<verification>
1. `node --check data/convert-csv-to-import-2026-09-18.mjs` — script is syntactically valid
2. `node data/convert-csv-to-import-2026-09-18.mjs` — stdout reports 66 matched, 0 unmatched, and a completed/failed/skipped breakdown with skipped &gt; 0
3. `data/habits-import-2026-09-18.json` — `schemaVersion: 1`, `habits.length === 66` (same id set as the 09-17 catalog, objects unmodified), every log has `status` in `{completed,failed,skipped}` and no `completed: boolean` field, no log dated after 2026-09-18
4. `git status --porcelain data/convert-csv-to-import-2026-09-17.mjs data/habits-import-2026-09-17.json "data/Nawyki v1.csv"` — empty (no historical artifact was touched)
5. No files under `js/`, `css/`, `index.html`, or `desktop.html` are modified
</verification>

<success_criteria>
`data/convert-csv-to-import-2026-09-18.mjs` exists and runs cleanly, producing
`data/habits-import-2026-09-18.json` with all 66 habits matched (0 unmatched), every log carrying
a `status` of `completed`/`failed`/`skipped` (skipped days now correctly imported instead of being
silently dropped), no log dated after 2026-09-18, and all 09-17 historical artifacts left
byte-identical.
</success_criteria>

<output>
Create `.planning/quick/260918-kzo-fix-csv-import-add-skipped-day-status-co/260918-kzo-SUMMARY.md` when done.
</output>
