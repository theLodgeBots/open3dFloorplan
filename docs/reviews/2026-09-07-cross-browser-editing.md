# Cross-browser editing and project exchange

Issue [#65](https://github.com/laanlabs/openPlan3D/issues/65), PR
[#66](https://github.com/laanlabs/openPlan3D/pull/66).

## Behavior and coverage

The full production browser suite now runs in Chromium, Firefox and WebKit.
Each engine has its own Linux CI job and isolated profile/server. All jobs use
one production build; unit tests, type checks, audit and build run once. The
Firefox job uses a virtual display and software OpenGL to exercise real WebGL
rendering. Tests finish before the job deadline and stop after five failures so
reports remain available even when the runner cannot support a workflow. The
existing `check` status is an aggregate gate that fails if the build or any
browser job fails or is skipped. Reports and failure traces have distinct engine
names and seven-day retention; the shared build expires after one day. Artifact
actions are pinned to Node 24 releases.

Coverage includes numeric editing, undo/redo, persistence, multi-floor views,
local storage migration/conflicts/quota recovery, library backups, JSON and native
project-package exchange, item photos/metadata, furniture rendering, and lazy,
cacheable assets. Desktop and phone-width cases remain part of the same suite.
Cloud uploads and analytics are disabled. This adds no Firebase service, storage
writes, schema changes or account requirement.

The cache regression records timing metadata but does not depend on every engine
reporting a cached image's encoded size or even creating another timing entry.
It opens the warmed 3D view offline and compares decoded texture dimensions and
pixel hashes with the cold load, while retaining byte limits, cache-header checks
and zero startup model-download assertions.

## Keyboard defect reproduced in Safari

Selecting a wall, focusing Thickness, pressing Cmd+A and typing `33.75` previously
selected all plan objects and appended digits to the old dimension. The window
canvas listener ran before the field guard in the shared shortcut handler. It
also intercepted Space, clipboard commands and selected-annotation deletion
while editing fields.

The canvas now returns before those actions for input, textarea, select and
content-editable targets. Save remains available; native text selection,
clipboard and undo/redo stay with the focused field. Plan undo/redo continues to
work outside fields and through toolbar buttons. Browser regressions use real
keyboard events to replace a fractional furniture width, type spaced notes,
copy/paste/undo text with an already populated plan clipboard, save and reload.
They compare the complete floor geometry and settings to the expected changes.

Those keyboard tests also reproduced a furniture-field defect: clearing a width
immediately committed 1 cm, so subsequent digits could produce `178.125` instead
of `78.125`. Width, depth and height now keep geometry unchanged for empty or
invalid drafts, restore the prior value on blur, accept fractional input and use
the same 1 cm minimum in metric/imperial display units.

## Verification

Local Node 24 checks: **541 unit tests**, type checks with **zero errors and 23
existing warnings**, and production build pass. Final engine results are recorded
in the PR checks and completion comment.

Interactive desktop Safari QA used a separate localhost project imported from
`native-project-package.zip`. Verified the three-floor preview, corrected Cmd+A
numeric editing, spaces and native copy/paste/undo in notes, 3D and stacked floors.
The actual Safari-downloaded ZIP was decoded: wall thickness `0.3375` metres,
new note, retained item price and both original attachment byte arrays matched.
Reopening the saved Safari project retained the dimension and note.
Interactive in-app browser checks also verified empty/zero/negative furniture
draft recovery and imperial editing/persistence at desktop and phone widths.

## Limits and follow-up

[Playwright's WebKit](https://playwright.dev/docs/browsers) is engine coverage;
Linux CI does not establish shipping Safari or physical iPhone/iPad compatibility.
The bounded desktop Safari pass above does not cover all workflows. Physical
touch/gesture/share-sheet tests and native release validation remain required.

The selected-wall highlight materials and separate camera-preview renderer
resource observations remain a separate measured audit. No claim of complete
Planner 5D parity or completed Firebase cost gates is made; see `NEXT.md` and #30.
