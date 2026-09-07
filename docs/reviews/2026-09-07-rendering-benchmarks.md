# Furnished-home benchmarks and scene invalidation

September 7, 2026 · [Issue #69](https://github.com/laanlabs/openPlan3D/issues/69)
· [PR #70](https://github.com/laanlabs/openPlan3D/pull/70)

## Behavior

Renaming a project or editing an item's note, cost, photos or construction metadata
used to rebuild every mesh and recenter the 3D camera. A local browser check
reproduced a top-down view jumping back to the default perspective after a rename.
The viewer now compares a value snapshot of the displayed floor content and
retains the existing scene when that content has not changed. Large package/photo
payloads and 2D-only overlays are excluded from the snapshot.

Geometry, opening styles, furniture transforms/finishes, room labels, floor
levels/elevations and stacking changes still rebuild. Snapshots detect in-place
edits as well as cloned undo/redo states. All floors participate in stacked mode;
only the active floor participates otherwise. Newly loaded texture pixels force
a refresh, and changing metric/imperial units now refreshes the 3D area labels.
Whole-scene rebuilding for visual edits remains a measured follow-up opportunity.

## Repeatable fixtures

`npm run benchmark:fixtures` writes ordinary importable JSON files under
`/tmp/openplan3d-render-fixtures` (or pass another output directory). Each connected
450 cm room contains six furniture instances sharing three bundled catalog files.
IDs, dimensions and dates are deterministic; no credentials or photo payloads are
included. Fixture tests validate importability and detected room counts.

| Home | Floors | Total rooms | Total walls | Total furniture | Active-floor furniture |
| --- | ---: | ---: | ---: | ---: | ---: |
| Small | 1 | 4 | 12 | 24 | 24 |
| Medium | 2 | 18 | 48 | 108 | 54 |
| Large | 3 | 48 | 120 | 288 | 96 |

Stacked reference floors currently render simplified walls, openings, columns and
slabs. They do **not** render the inactive floors' furniture or full finishes, so
total project furniture is not the number simultaneously drawn in stacked mode.

## Measurement method and limits

After a production build, `npm run benchmark:viewer` imports all three homes using
the UI in two Chromium profiles: 1440×900 at DPR 1 and 390×900 at DPR 2. It records
first draw, ready, project rename, stacking, drag frame intervals and WebGL object
counts. Each test starts with a fresh browser context and checks that exactly
three distinct bundled model URLs were requested, no external requests occurred,
renaming allocated no new GPU objects, and leaving 3D released the context.

The two benchmark CI jobs reuse the correctness suite's production build and store
`metrics.json` files in `rendering-benchmarks-desktop` and
`rendering-benchmarks-phone-viewport` artifacts for three days. Each job runs its
three sizes serially; the profiles run on separate runners to keep software
rendering within the job timeout. The final
`check` requires the benchmark's functional assertions and all three browser
engines to pass. Elapsed timings are informational, not thresholds on shared CI.

CI uses SwiftShader software rendering. The phone profile is a viewport and pixel
density, not a physical phone, touch test or mobile GPU. Elapsed operations include
Playwright/UI scheduling; ready waits for a 500 ms network-idle interval and is not
just CPU build time. Drag intervals measure requestAnimationFrame scheduling,
not GPU timer queries. Counts measure live/created WebGL objects, not byte usage,
JS heap or operating-system memory. They expose churn and leaks without claiming
an absolute memory budget.

## Recorded results

The [raw measurements](2026-09-07-rendering-metrics.json) retain the six-sample
baseline and five complete initial updated samples, with commit/run provenance.
The initial updated run passed five samples before exhausting the combined
10-minute suite limit; final CI separates the two profiles. See PR checks for
final six-sample and browser status.

Desktop rename measurements from those runs:

| Home | New buffers, before → after | New textures, before → after | Rename elapsed, before → after |
| --- | ---: | ---: | ---: |
| Small | 1,014 → 0 | 6 → 0 | 18.7 s → 1.2 s |
| Medium | 2,054 → 0 | 13 → 0 | 28.8 s → 1.0 s |
| Large | 3,446 → 0 | 24 → 0 | 40.9 s → 0.6 s |

All three also eliminated five program allocations per rename. Active-scene live
counts were unchanged: 716/1,356/2,188 buffers and 17/24/35 textures respectively.
This establishes eliminated rebuild work and view preservation, not lower steady
scene memory or a general FPS improvement.

Do not interpret those elapsed values as an isolated speedup ratio: queued GPU
and shader work can shift to a later operation. In these same desktop runs,
stacking elapsed changed from 0.4/0.9/2.8 seconds to 25.2/35.3/63.0 seconds, while
drag p95 intervals varied from 650–2,183 ms to 867–11,166 ms. These single samples
on shared software renderers need repeated hardware calibration before attributing
changes in total interaction latency. The strict gates are zero rename allocation,
pixel preservation and correct visual invalidation; raw timings remain visible.

## Validation

Local unit tests: **562 passed**. Type checking: zero errors and 23 existing Svelte
warnings. Production build passes. The cross-engine regression checks pixel and
allocation preservation through note/name edits, then verifies that thickness,
undo/redo and display-unit changes still update the viewer. Existing resource,
texture, furniture-fidelity and package regressions remain part of the full suite.

Local interactive browser checks reproduced the baseline camera reset, then
verified preserved top-down views for names/notes, stacking, wall thickness,
undo/redo and imperial area labels in the updated build. A large home at 390×900
retains its view after renaming, but Top-Down View crops the outside room columns;
that preexisting aspect-ratio defect is tracked in [#71](https://github.com/laanlabs/openPlan3D/issues/71).
No runtime warnings/errors appeared in these interactive checks. Final CI measurements
and release status are recorded below and on the PR.

## Next measurements

Calibrate desktop Safari and physical iPhone/iPad runs with these same fixtures,
recording device/browser, thermal state, viewport/DPR and repeated cold/warm runs.
Agree hardware frame-time and memory budgets before choosing reduced mobile
quality, shared geometry/instancing, object-level updates or other rendering
changes. Linux engine coverage and the CI phone viewport do not close this gate.

Ordinary editing, history, photos and fixture imports remain local. Catalog assets
remain bundled and cacheable; this batch adds no Firebase Storage writes or
persistent cloud data. Release/migration/billing gates remain in issue #30.
