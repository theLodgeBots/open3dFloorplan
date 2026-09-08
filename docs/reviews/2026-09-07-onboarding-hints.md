# Responsive onboarding hints

September 7, 2026 · [Issue #73](https://github.com/laanlabs/openPlan3D/issues/73)

## Reproduction and change

Opening Export at desktop width and shrinking to 280 pixels left the active hint
at x=300 with a width of only 87.8 pixels. It was outside the visible screen.
The template read `window.innerWidth` without a reactive resize dependency and
assumed a fixed hint height when clamping its vertical position.

The component now binds viewport dimensions and measures the rendered hint. It
uses a normal width up to 280 pixels, an eight-pixel screen margin and the actual
height to constrain placement. In very short viewports the message can scroll
while Got it remains visible. The entrance animation only changes opacity so it
cannot temporarily translate the bubble past the screen edge. The hint has a
named region for assistive technology.

Each active hint owns its animation callback and eight-second dismissal timer.
Replacement or unmount cancels them; viewport changes only update placement.
The existing seen-tip storage behavior is unchanged.

## Validation

Local production build and 582 unit tests passed. Type checking reports zero
errors and the 23 existing Svelte warnings. Interactive browser QA verified the
desktop-to-280-pixel resize: the hint moved to x=8 and used 264 pixels of width.
At the in-app browser's minimum 160-pixel height, the full hint and Got it stayed
within the screen and dismissal worked. This was viewport QA, not a physical
iPhone/iPad check.

Two browser workflows exercise the real Export and 3D controls. The first checks
hint bounds, readable width and hit-testing on Got it through desktop, phone,
landscape, 280×130 and 200×100 sizes, then verifies dismissal survives reload.
The second controls time to check replacement deadlines, resize without extending
the timer, automatic dismissal, and seen/unseen behavior. Screenshots are attached
to CI reports. The full suite is now 65 workflows per engine (195 across Chromium,
Firefox and WebKit), plus the six existing rendering benchmarks. See the PR and
GitHub checks for final results and deployed verification.

## Remaining work and cost

The hardware performance, native-device coverage, release/migration/billing gates,
catalog fidelity and area agreement follow-ups remain in `NEXT.md`. This change
does not add Firebase writes, uploads, external assets or dependencies.
