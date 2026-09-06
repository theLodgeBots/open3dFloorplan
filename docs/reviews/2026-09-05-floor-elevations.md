# Floor elevations and stacked cameras

Issue #42 is addressed through **Settings → Project → Floor elevations**. Each
floor has an optional `elevation` in centimetres above ground; negative values
represent basements. Values are independent, so raising an upper floor does not
resize walls or move its neighbours. The existing floor level remains the order
for the selector and lower-floor reference. Elevations may intentionally overlap
for split-level layouts; no automatic collision or roof/slab design is added.

Legacy files without the field retain `level × 300 cm`, including skipped levels,
basements and the array-order fallback for files without levels. Invalid imported
elevations fall back without modifying the imported source. The editor rejects
non-finite values and restores blank/invalid inputs on blur. Reset restores the
level-based default. Edits participate in per-floor undo/redo, local save/reload,
JSON import/export and project duplication. New top floors continue 300 cm above
the previous top floor's adjusted elevation (with the legacy spacing for gaps).

Stacked geometry, floor labels, placement planes, walkthrough eye height and
interior camera poses use the active floor's elevation. Camera markers and
previews follow elevation edits and stacking toggles. Floor switches clear the
old interior camera and exit walkthrough. The presentation ground moves beneath
the lowest basement, and top-down framing includes elevated geometry. The
isolated active-floor view retains its existing local zero-height ground.

Settings now fits compact screens, scrolls its tabs, and closes with Escape from
inside the dialog. Browser testing caught 3D controls blocking the compact floor
menu; isolating the viewer's stacking context keeps project menus on top.
The camera preview canvas is reactive so its first mounted
preview can render; replaced marker geometry is disposed.
Walkthrough handles rejected mouse capture with a visible keyboard fallback,
clears placement modes on entry, and releases its controls on unmount.

Validation at implementation: 216 unit tests pass; type checking has zero errors
and 24 remaining warnings; the production build passes. Tests raycast through
actual Three.js wall meshes from floor-relative cameras on four mixed-height
storeys, including a basement, and cover invalid data, legacy defaults, additions,
removal, persistence and undo/redo. Browser coverage adds desktop and 390 px
workflows for editing, reset, undo/redo, import/export, save/reload and stacked
views, plus desktop walkthrough and rejected-mouse-capture coverage. Final CI, interactive and rollout results are
recorded on the release PR.

No Firebase Storage calls, services, dependencies, IAM permissions or retention
settings are added. Storage migration and billing work remains in issue #30.
The companion app is unchanged; this is not an iPhone distribution release.
