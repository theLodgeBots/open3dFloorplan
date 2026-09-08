# Responsive top-down camera framing

September 7, 2026 · [Issue #71](https://github.com/laanlabs/openPlan3D/issues/71)
· [PR #72](https://github.com/laanlabs/openPlan3D/pull/72)

## Problem and change

At 390×900, the furnished-home benchmark's outside room columns were cropped after
clicking **Top-Down View**. The perspective view already fit all bounding-box
corners using both fields of view; Top-Down instead used a fixed multiple of the
largest plan dimension. It ignored the narrow viewport's horizontal field of view.

Both views now use the same corner-fitting calculation. Top-Down chooses a stable
almost-vertical camera direction, fits horizontal and vertical extents, and leaves
vertical space around the model for the toolbar and lower overlays. This also
addresses a landscape check where a fitted corner was covered by the toolbar.
Very long plans can require camera distances beyond the initial far plane, so
fitting also extends that plane to include the back of the complete floor stack.

An explicit Top-Down action consumes pending orbit/pan damping before setting the
new camera pose. It exits walkthrough so the next movement frame cannot replace
that pose. Viewport resizing keeps manual camera positioning; clicking Top-Down
again refits the current viewport. No project geometry or saved data is changed.

## Regression coverage

The shared camera tests project every bounding-box corner after 60 actual
`OrbitControls.update()` calls, using ordinary homes, tall stacks with basements,
and long buildings in portrait, desktop and landscape aspects. Additional cases
cover changed aspect/zoom, empty floors and vertical overlay clearance.

`tests/fixtures/top-down-framing.openplan.json` is an ordinary local import with
three floors at -350, 0 and 425.5 cm and magenta columns at the four outside corners.
After acknowledging the first-use hint through its UI, the browser test checks rendered pixels in all four quadrants, distance from the
canvas edges, and overlap with viewer buttons. It exercises active/stacked views
at 1440×900, 390×900 and 844×390, requesting Top-Down while orbit damping is in
flight and checking again after more frames. It also checks leaving walkthrough
when the browser denies mouse capture. Screenshots and measured pixel bounds are
attached to the normal CI reports; no production debug hooks are added.

Local validation: **582 unit tests passed**, zero type errors with 23 existing
Svelte warnings, and a successful production build. The production-browser suite
now has 63 workflows per engine (189 across Chromium, Firefox and WebKit), plus
the six existing rendering benchmarks. See GitHub checks for their final results
and merge/release status.

Local interactive QA covers the corner fixture at phone/landscape sizes, stacked
floors, the originally reported large furnished-home fixture, and empty floors.
These are browser viewport checks, not physical iPhone/iPad testing. The previous
native Safari attempt was unavailable while the Mac was locked; hardware/device
calibration remains follow-up work.

## Follow-up and cost

The responsive pass also exposed stale onboarding-tip positioning after a viewport
resize, tracked separately in [#73](https://github.com/laanlabs/openPlan3D/issues/73).

Use the repeatable furnished-home fixtures to calibrate actual desktop/phone
performance before choosing shared geometry, object-level updates or mobile
quality controls. Source/license catalog maintenance, area agreement and native
release coverage remain in `NEXT.md`. The release/migration/billing gates in #30
remain open. This camera-only change adds no Firebase writes, media uploads,
external assets or dependencies.
