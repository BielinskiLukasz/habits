---
phase: quick-260829-ucr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - js/i18n/en.js
  - js/i18n/pl.js
  - js/views/today/builders.js
  - js/views/settings.js
  - css/desktop.css
autonomous: true
requirements:
  - UCR-move-analytics-link

estimate:
  tokens: 18000
  raw_tokens: 12000
  tasks: 2
  confidence: high

must_haves:
  truths:
    - Footer nav on the mobile shell has five items (today, history, catalog, settings, analytics)
    - The analytics link in footer navigates to ./desktop.html
    - Settings panel no longer contains a standalone desktop link paragraph
  artifacts:
    - js/i18n/en.js — contains nav.analytics key with value "analytics"
    - js/i18n/pl.js — contains nav.analytics key with value "analityka"
    - js/views/today/builders.js — linkDefs has 5 entries ending with desktop.html
    - js/views/settings.js — desktop link block removed
    - css/desktop.css — .settings-desktop-link rules removed
  key_links:
    - t('nav.analytics') in builders.js resolves via en.js/pl.js nav.analytics key
---

<objective>
Move the analytics link from the bottom of the settings panel into the footer navigation bar so it is always reachable without opening settings.

Purpose: Reduces friction in switching to the desktop analytics shell; keeps the footer nav as the single navigation surface.
Output: Five-item footer nav; settings panel free of the standalone desktop link.
</objective>

<execution_context>
@C:/my-code/vibe-coding/habits/.claude/gsd-core/workflows/execute-plan.md
@C:/my-code/vibe-coding/habits/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@C:/my-code/vibe-coding/habits/.planning/PROJECT.md
@C:/my-code/vibe-coding/habits/.planning/ROADMAP.md
@C:/my-code/vibe-coding/habits/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add nav.analytics i18n keys and footer nav link</name>
  <files>js/i18n/en.js, js/i18n/pl.js, js/views/today/builders.js</files>
  <action>
    In js/i18n/en.js, insert `'nav.analytics': 'analytics',` after the `'nav.settings'` line (line 15).

    In js/i18n/pl.js, insert `'nav.analytics': 'analityka',` after the `'nav.settings'` line (line 13).

    In js/views/today/builders.js, in `buildFooterNav()`, append a fifth entry to the `linkDefs` array after the `#settings` entry:
    `{ href: './desktop.html', text: t('nav.analytics') }`
    No `disabled` property is needed — the aria-current check compares href to the current hash string, so `./desktop.html` will never match any hash and will never receive aria-current="page".
  </action>
  <verify>
    <automated>node --test tests/ --test-name-pattern="builder|footer|nav|i18n"</automated>
  </verify>
  <done>
    en.js and pl.js each contain a nav.analytics key in the nav block. buildFooterNav() linkDefs array has 5 entries; the last entry has href './desktop.html' and text from t('nav.analytics').
  </done>
</task>

<task type="auto">
  <name>Task 2: Remove settings desktop link from settings.js and desktop.css</name>
  <files>js/views/settings.js, css/desktop.css</files>
  <action>
    In js/views/settings.js, remove the desktop link block (~lines 901-909). The block begins with the comment `// Desktop link (D-115, DESKTOP-01)` and ends with `_panelEl.appendChild(desktopLinkEl);`. Delete the entire block (6 lines: comment, createElement('p'), setAttribute, createElement('a'), anchor.href, anchor.textContent, appendChild(anchor), appendChild(desktopLinkEl)).

    In css/desktop.css, remove the `.settings-desktop-link` CSS block (~lines 186-197). The block begins with `/* Settings desktop link */` and ends after the `.settings-desktop-link a:hover` closing brace. Delete the comment and all three rule blocks (the paragraph rule, the anchor rule, the hover rule).
  </action>
  <verify>
    <automated>node --test tests/ 2>&1 | tail -5</automated>
  </verify>
  <done>
    settings.js no longer creates or appends any element with class settings-desktop-link. desktop.css contains no .settings-desktop-link selector. All existing tests pass.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user → footer nav | href values are hardcoded strings; no user input crosses this boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation |
|-----------|----------|-----------|----------|-------------|------------|
| T-ucr-01 | Tampering | footer nav href | low | accept | href is a hardcoded relative path; no dynamic input |
</threat_model>

<verification>
After both tasks:
- node --test tests/ passes with no new failures
- Opening index.html in a browser shows five footer nav items including "analytics" (or "analityka" in Polish locale)
- Clicking "analytics" navigates to desktop.html
- Settings panel no longer shows a standalone desktop link at the bottom
</verification>

<success_criteria>
Footer nav has five items ending with the analytics link. Settings panel has no desktop link block. All tests pass.
</success_criteria>

<output>
Create `.planning/quick/260829-ucr-move-the-analytics-link-from-bottom-of-s/260829-ucr-SUMMARY.md` when done.
</output>
