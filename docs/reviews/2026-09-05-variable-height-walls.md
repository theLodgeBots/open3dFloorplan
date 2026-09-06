# Variable-height walls

This batch integrates contributor PR #13, preserving its original commits, and
adapts the feature to the current editor and test suite. All editing, rendering,
undo, save and JSON exchange remain local; no hosted service or Storage request
is added.

Walls have optional `startHeight` and `endHeight` values in centimetres. Legacy
walls retain their existing uniform `height`; editing endpoints keeps `height`
synchronized to their maximum for older readers. Zero-height gable tips are
supported. Negative/non-finite edits are ignored, and blank/invalid fields revert
on blur. Start/end edits have independent undo groups.

The same opening-span calculation drives elevation, wall cutouts and 3D previews.
It checks both edges beneath a slope, clips out-of-bounds spans, and subtracts the
union of overlapping openings. Frame pieces are clipped too. Stored door/window
dimensions are preserved; the properties panel warns when they do not fit.
Mesh tests call the production geometry builder, including true triangular tips
without an artificial raised edge.

Reversing a wall preserves door hinge/opening orientation and position, swaps
endpoint heights and explicit side materials, and updates window positions.
Splitting retains shared/side textures and interpolates the new junction height.
Partial exterior-wall copies also interpolate their endpoint heights. Curved
walls use the same sampled path in active and stacked views. Flat ceilings are
omitted only for rooms with sloped or inconsistent boundary heights.

Validation at implementation: 207 unit tests pass; type checking has zero errors
and 25 existing warnings; the production build passes. Browser CI adds a fourth
workflow for numeric height edits, undo/redo, invalid input, reversal, preserved
opening data, elevation, JSON save/reload, stacked curves and zero external HTTP
requests. Final CI and interactive/live browser results are recorded on the PR.

Scope limits: this adds sloped wall profiles, not a roof/slab design system.
Floor spacing remains the existing 300 cm per level. Curved-wall openings retain
the editor's existing limitation: active and stacked curved surfaces do not cut
opening holes. Plan-view graphic exports show footprints; editable JSON retains
the height fields, and elevation/3D show the profiles. The companion's current
outbound handoffs remain uniform-height captures; this release does not add
bidirectional iPhone project import or a new interchange format version.
