# Versioning Policy

Nawyki uses [Semantic Versioning 2.0.0](https://semver.org/) for `APP_VERSION` (the value in `js/util/version.js`).

Format: `MAJOR.MINOR.PATCH` (with optional `-prerelease` and/or `+build` suffixes).

The SW cache name derives directly: `` `nawyki-${APP_VERSION}` `` (no `v` literal prefix).

## Current Phase: Initial Development (`0.y.z`)

Per **SemVer §4**: *Major version zero (0.y.z) is for initial development. Anything MAY change at any time. The public API SHOULD NOT be considered stable.*

While the v1.0 milestone (Phases 1-6) is being built, the version stays in the `0.y.z` range. **Breaking changes during this phase do NOT trigger a MAJOR bump** — they bump MINOR instead.

| Change type during `0.y.z` | Example bump | When |
|---|---|---|
| Bug fix, internal refactor, shell-asset-only change (CSS tweak, copy fix, icon adjustment) | `0.1.0` → `0.1.1` | Most commits during a phase |
| New feature, breaking change to IDB schema or app data shape, anything user-visible that changes behavior | `0.1.0` → `0.2.0` | End of each Phase (1 → 2 → 3 → ...) OR mid-phase when introducing a substantial new capability |

**Mapping to roadmap:**

| When | Bump to |
|---|---|
| **Now (Phase 1 complete)** | `0.1.0` |
| Phase 2 complete (Storage Foundation) | `0.2.0` |
| Phase 3 complete (Today View & Settings) | `0.3.0` |
| Phase 4 complete (Domain Model) | `0.4.0` |
| Phase 5 complete (Backup & Restore) | `0.5.0` |
| Phase 6 complete (Desktop Analytics & Scoring) | `0.6.0` |
| **v1.0 milestone seal (after Phase 6 verified + UAT signed off)** | `1.0.0` |

Patch bumps (`0.1.0` → `0.1.1`) land for any shell-asset-only change between phases.

## After v1.0 (`1.y.z` and beyond)

Once `1.0.0` ships, the public API and storage shape are considered stable. Standard SemVer rules apply:

| Change type | Example bump | Trigger |
|---|---|---|
| **PATCH** | `1.0.0` → `1.0.1` | Backwards-compatible bug fix; shell-asset-only change (CSS, copy, icon) |
| **MINOR** | `1.0.1` → `1.1.0` | Backwards-compatible feature addition; new optional capability |
| **MAJOR** | `1.1.0` → `2.0.0` | **Incompatible** API change OR breaking storage-shape migration (`schemaVersion` changes against existing user data) |

Every `schemaVersion` migration after v1.0 → MAJOR bump. The cache name change wipes the SW cache; the schema migration handles the data.

## How a bump works

1. Edit `js/util/version.js`, change `APP_VERSION` literal.
2. Commit. (Optional: tag the commit `git tag v0.1.1`.)
3. Push to `main`. GitHub Pages serves the new bytes.
4. On the user's next page load, `sw.js` `activate` handler deletes every cache whose name is not the current `` `nawyki-${APP_VERSION}` ``, then `clients.claim()` takes over.
5. Because `hadController` was true going into the new SW, `controllerchange` fires and the toast "New version ready — Reload" appears. The user clicks Reload at their leisure — no auto-reload (D-08 / D-09).

See also:
- `README.md` § "Bumping the version" — quick reference
- `.planning/PROJECT.md` Key Decisions — D-28 (versioning) + D-10/D-12 (cache derivation)
- `js/util/version.js` — the single source of truth

## Why not just start at 1.0.0?

Calling code `1.0.0` while still in active development implies the public API is locked. Anyone reading the version (or running automation that compares versions) would assume backwards-compatibility guarantees that don't yet exist. The `0.y.z` range is the SemVer-blessed signal for "this is not stable yet — anything may change."
