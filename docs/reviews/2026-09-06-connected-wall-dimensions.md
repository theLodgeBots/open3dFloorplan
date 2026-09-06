# Connected wall dimensions — September 6, 2026

Issue #45 fixes a mismatch between dragging a joined corner and editing a wall's
numeric length. The old numeric handler moved only the selected wall, leaving the
adjacent endpoint behind and removing the detected room. Whole-centimetre rounding
also obscured fractional wall lengths, and blank size fields could overwrite
geometry with zero or one.

## Changes

- Wall length edits choose a fixed start (A) or end (B), scale the selected wall
  about that endpoint, and move neighbouring endpoints that shared the opposite
  corner. Pointer dragging and numeric resizing now use the same 2 cm connection
  tolerance. Resizes are prepared and validated before one grouped store mutation.
- Joined walls that would collapse below 1 cm, invalid coordinates and invalid
  lengths are rejected without project/history changes. Unchanged length edits
  preserve redo. Rapid edits to the same wall/anchor retain undo coalescing.
- Curved walls scale their control point about the chosen anchor using the existing
  sampled arc-length measurement. Wall heights, materials, opening dimensions and
  normalized opening positions are preserved. Room metadata stays associated with
  the same wall IDs. Other floors are untouched.
- Numeric wall/door/window drafts reject blank/non-finite/invalid sizes without
  mutating the model, restoring the stored value on blur. Zero window sills and
  valid endpoint positions remain supported. Distance inputs retain fractions and
  enforce the wall's actual range rather than a 5%/95% clamp.
- Length inputs keep fractional centimetres, accept Enter or blur to commit, and
  do not convert a rounded imperial display back into geometry merely on focus/blur.
  The same precision protection applies to wall heights, thickness and openings.
- The desktop properties panel participates in the layout instead of covering the
  layers list. The compact bottom sheet remains available on phone widths.

This is connected-corner editing, not a geometric constraint solver: neighbouring
walls may change angle, interior T-junction constraints are not propagated, and
curved-wall opening holes remain separate work. No project schema, cloud service,
Firebase Storage traffic, or iOS client behavior changes.

## Validation

281 unit tests pass, including 25 new geometry/store regressions for joined and
rotated corners, both anchor choices, curved scaling, tolerance, named-room
preservation, other-floor isolation, metadata, undo/redo, invalid/collapsing edits,
positive dimensions, zero sills, and invalid positions. Production browser
workflows at 1440px and 390px exercise import, layer selection, connected edits,
room retention, fractional dimensions, input recovery, imperial conversion,
undo/redo, save/reload/export, and 3D, with zero external editing requests.

Type checks, production build, CI and interactive/live browser results are recorded
on the linked implementation PR before release.
