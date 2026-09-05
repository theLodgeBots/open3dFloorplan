# Multi-floor reliability and view lifecycle

Implemented September 5, 2026 on `codex/multifloor-reliability`.

## Changes

The feature work from community PR #23 is integrated with its original commits in
the ancestry. The existing npm lockfile and Firebase/Node deployment configuration
are retained; the contribution's separate Vercel adapter and pnpm lockfile are not
part of the resulting implementation.

- Add a top floor using the selected floor's exterior walls, all walls, or an
  empty layout. Door/window instances, furniture, room names and other storey
  contents remain on their original floor. Copies have fresh wall IDs and
  independent endpoints/control points.
- Exterior detection classifies sections between room junctions. A wall that is
  partly a partition and partly exterior retains only its exterior sections;
  multiple retained sections have distinct IDs. This avoids missing boundary
  pieces and unnecessary upstairs partitions. Open sketches retain all walls.
- A dim, non-interactive reference shows the nearest lower floor's walls and
  stairs. It draws above room fills, can be disabled in Layers, and is framed
  when opening an empty upper floor. Exterior detection is cached by geometry.
- Floor creation uses the highest existing level plus one. The selector,
  floor-below reference and stacked 3D share level ordering, including unordered
  arrays, gaps and negative levels. Legacy files missing levels retain array
  order. Stacked spacing remains the existing 300 cm per level.
- The active 3D floor is raised before other floors are added, preventing lower
  floors from moving with it. Labels use a common horizontal anchor. Placement
  uses the active floor's plane, and room materials/labels resolve from that
  floor rather than a previous 2D canvas's room cache.
- Switching floors clears selections, unfinished drawing tools and elevation
  targets. Add/remove retain single-step undo/redo. Removing a missing or final
  floor creates no spurious undo entry.
- A compact floor selector, visible removal action, and compact toolbar below
  the desktop breakpoint keep the controls usable as floor count grows. The
  duplicated desktop zoom controls remain available on the canvas.
- The 2D canvas now owns one animation loop, released on unmount. Previously,
  additional redraw requests started additional loops and the canvas could run
  after switching to 3D. Texture listeners and component-owned subscriptions
  are also released. A browser reproduction emitted four `derived_inert`
  warnings before this fix; the fresh-tab verification emitted none. Svelte
  documents this warning as reading derived state after its owner was destroyed:
  [runtime warnings](https://svelte.dev/docs/svelte/runtime-warnings#Client-warnings-derived_inert).

These operations remain local. No Firebase Storage rules, retention settings,
quotas, billing configuration, cloud content, or iOS source changed. Issue #30's
remaining cost controls still apply before expanding hosted handoffs.

## Validation

135 tests pass across 16 files. Type checks report zero errors and 25 existing
warnings. The Node production build succeeds; dependency audit reports zero
vulnerabilities. The contributor's script checks were migrated into the normal
Vitest suite and extended with partial boundaries, store operations, and real
Three.js world-position checks with ground/middle/top floors active.

Browser checks used the built Node adapter and synthetic local projects:

| Scenario | Observed result |
| --- | --- |
| Exterior seed from partitioned ground floor | Four exterior walls; one enclosed upstairs room; openings remain downstairs |
| All-walls seed | Five walls and two rooms; no copied door/window |
| Empty seed | Zero active walls; reference floor is visible and framed |
| Floor reference | Toggle hides/shows the lower floor; clicking its partition selects the active room rather than a lower-floor wall |
| Add menu | Escape closes the menu; choices close it after use |
| Undo/Redo | One click removes/reinstates the newly added floor and selected floor |
| Delete middle floor, then add | Ground Floor, Floor 2, Floor 3; no reused level/name |
| Save/reload | Floor order, geometry and active floor restored |
| Stacked 3D | Active upper floor stays above translucent ground floor; deleted-level gaps remain; all floors are framed |
| Elevation then floor switch | Returns to Plan; old wall selection/properties are cleared |
| Repeated 2D/3D switches | Final fresh-tab console has zero warnings/errors |
| Toolbar at 1280×720 | Project name, floor selector, Save and export remain visible |

The automated partial-boundary tests check that the copied outline encloses the
expected 45 m² and 36 m² areas, rather than only counting selected wall IDs.
The render-loop tests verify a single outstanding frame and no rendering or
rescheduling after teardown, including teardown during a callback.

Limits: phone-width layout, actual touch, Safari, Firefox, physical printing and
completed PDF download delivery were not verified. The floor reference follows
the existing room detector's chord interpretation of curved walls. This is not
a new variable-height floor/roof model; non-active stacked floors retain the
existing simplified rendering. Production rollout checks are recorded on the PR
after release.

## Repeatable browser checklist

1. Import `tests/fixtures/multifloor-plan.openplan.json` using Export → Import JSON.
2. Add a floor using Exterior walls. Check four walls, no copied openings, the
   dim partition/stair beneath, and the Floor Below toggle in Layers.
3. Switch to Ground Floor. Add using All walls; check five walls/two rooms.
   Undo and redo once. Add an empty floor and test Fit plus reload framing.
4. Remove a middle floor using the floor menu. Add another and check unique
   numbering, nearest-lower-floor selection, and Save/reload.
5. In 3D, enable Show All Floors Stacked and switch the active floor. Check each
   storey remains at its own elevation, including a gap after deletion.
6. Select a wall in 2D, enter Elevation, then select another floor. Check Plan
   returns without old wall properties. Repeat 2D/3D switches and inspect logs.
