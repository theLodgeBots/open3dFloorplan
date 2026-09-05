# iPhone → web geometry handoff, version 1

The iPhone app's **Export Editable Plan (JSON)** and **Open in OpenPlan3D** use the
same geometry payload. Local JSON exchange needs no Firebase upload. Import it
using the web toolbar's **Export → Import JSON** or **Build → Import RoomPlan**.

This is a documented extension of RoomPlan JSON for one-way geometry exchange,
not the complete bidirectional project/attachment format proposed in the roadmap.
Apple's `version` field remains independent of `openplanHandoffVersion: 1`.
Unversioned Apple captures and older `openplanPrepared` exports remain accepted.
An unknown handoff version is rejected before replacing the current project.

## Coordinates and identity

- Lengths are metres in the payload and centimetres in the web model. Fractional
  centimetres are retained, with conversion rounded to eight decimal places.
- Transforms are column-major 4×4 matrices. Translation is at indices 12–14.
  The local X direction is `(transform[0], transform[2])` on the ground plane.
  RoomPlan X maps to web X; RoomPlan Z maps to web Y. Furniture headings use
  `atan2(transform[2], transform[0])`, converted from radians to degrees.
- Surface/object `identifier` values survive import. They must be unique.
  Openings reference a wall via `parentIdentifier` on the same `story`.
- Integer `story` values select floors; absent values mean zero. `stories` carries
  `{ index, name }` records, including intentionally empty floors. Gaps and negative
  levels are retained. This does not introduce configurable physical floor heights.

## Supported geometry and presentation fields

| Payload | Web result |
| --- | --- |
| Wall `dimensions: [length, height, thickness]` and transform | Independent start/end coordinates, height and thickness; zero/missing raw-scan thickness falls back to 15 cm |
| Door `style: single/double/sliding/patio` | Single/double/sliding; patio uses the existing sliding-door representation |
| Door `hingeLeft` | True places the hinge at the wall-start jamb, web `swingDirection: right`; false uses the wall-end jamb |
| Door `opensInward` | True opens toward the left-hand wall normal `(-dy, dx)`; web `flipSide: false` |
| Window `style: fixed/sliding` | Fixed/sliding window |
| Window `sillHeight` | Explicit height above its floor in metres; absent values derive from opening and parent-wall vertical transforms |
| Apple `openings` | Doorway passages, with no door leaf |
| Object dimensions and transform | Size, position and rotation; existing category-to-catalog mapping remains in use |
| Section `center`, `label`, `displayName`, `color` | Detected room association, custom room name and color |

The iPhone exporter sends resolved opening styles and orientation, including the
defaults. Older prepared exports omitted the default hinge: the importer treats
that as the iOS wall-start hinge. Raw Apple captures without orientation extensions
retain the existing default. `openplanPrepared: true` disables automatic geometry
straightening by default; explicit `openplanImportOptions` or dialog choices win.

Photos, tracing images, per-object notes, costs, wall materials and room ceiling
overrides are not imported into equivalent editable web fields in this batch.
Keep the iPhone session/full dataset for these. Patio-specific glazing is not
modeled. Geometry JSON contains no media uploads or new persistent cloud state.

## Validation and recovery

All RoomPlan surfaces are validated before building/loading a project: finite
dimensions/transforms, valid identifiers and parent references, integral floors,
room anchors, supported styles and typed import choices. A malformed element
rejects the whole import with a visible error, leaving the current project open.

A raw-capture ZIP must contain exactly one `room.json`. A dataset with `plan.json`
is rejected with instructions to export Editable Plan JSON: importing its raw
`room.json` would silently discard the iPhone edits. Full dataset archives remain
useful as local backups; they are not a supported edited-project web import yet.

iOS accepts missing legacy optional fields but rejects damaged present arrays or
wrongly typed fields. A valid empty edited plan remains empty. Existing unreadable
edited files block editing/export/handoff instead of falling back to an older scan.
The editor offers Retry, Export Original File and, when a scan exists, Recover
Original Scan. Recovery must first copy the exact edited bytes to
`plan-recovery-<UUID>.json` beside the original. The original is replaced only when
the user later saves the recovered plan. Unknown material/style strings survive
native save/reload; an unsupported opening style is rejected by the web importer.

## Contract fixtures

`tests/fixtures/handoff-plan.json` is a synthetic native document and
`tests/fixtures/handoff-roomplan.json` its expected handoff. Identical copies live
in the iOS test bundle. Swift tests compare the actual exporter against every
fixture key/value; web tests assert the resulting geometry, floor names, empty
floor, opening appearance, room metadata and furniture orientation. Any future
format change must update both repositories' fixtures and compatibility tests.
