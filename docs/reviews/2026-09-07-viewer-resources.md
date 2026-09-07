# Interior camera and 3D resource lifetimes

September 7, 2026. Tracks [#67](https://github.com/laanlabs/openPlan3D/issues/67)
and [PR #68](https://github.com/laanlabs/openPlan3D/pull/68).

## Reproduction and measurements

On main `49149e6`, an interior-camera preview drew normally the first time, then
remained blank after closing and placing another camera. The renderer still
referenced the removed canvas. Closing during the first placement step also left
placement mode active. Both were reproduced interactively in the in-app browser.

The pre-fix [CI measurement run](https://github.com/laanlabs/openPlan3D/actions/runs/34166158517)
uses the production build and instruments the browser's public WebGL API, with no
application debug hooks. It deliberately retains context references so garbage
collection cannot hide missing teardown. In Firefox:

- Closing the preview left **two live contexts**, including the disconnected
  preview canvas. Its context still held 10 buffers, 11 textures, 3 programs,
  10 framebuffers and 6 renderbuffers.
- For the one-room textured fixture, after warming both floor-display modes,
  retained texture allocations rose **23 → 28 → 33 → 38 → 43** across four
  stack/unstack cycles (eight rebuilds). Buffers (132), programs (8), framebuffers
  (10) and renderbuffers (6) stayed constant.
- The existing 58 Firefox browser tests passed; the two new resource tests failed
  on these measured expectations. The retained counts are allocations, not GPU
  byte estimates, JavaScript heap measurements or frame-time benchmarks.

## Changes

- The preview renderer follows its canvas lifetime. Closing, repositioning,
  changing floors or leaving 3D cancels pending preview frames and releases the
  old context. A new panel gets a renderer for its new canvas.
- Closing also removes and disposes the camera marker and clears placement state.
  Main-view and temporary photo/AI-capture renderers explicitly release their
  contexts. Photo capture restores temporary scene visibility and releases its
  renderer in `finally`, including rendering/encoding failures.
- Scene-generated texture wrappers (floors, walls, labels and ground) register
  ownership with the existing resource disposer. Rebuilds dispose replaced
  wrappers; shared decoded canvases and cached model templates remain available.
  Sky and shadow-map resources have explicit viewer teardown.
- Wall highlighting restores original materials before rebuilding or disposing a
  scene, disposes its cloned materials, and reapplies the selected wall afterward.
  Shared textures are borrowed by highlights. Selection changes mark the view
  dirty so the new highlight is rendered promptly.

## Validation

Local validation: **544 unit tests**, zero type errors, 23 existing Svelte
warnings and production build pass. The ownership tests exercise 100 repeated
selections, rebuilt highlighted scenes, and owned versus borrowed textures.

The new production-browser tests measure preview contexts at desktop and
390-pixel widths, repeated closing/reopening, repositioning, two 1920×1080 PNG
captures, 2D/3D remounts and textured scene rebuilds. They retain JSON allocation
samples in the CI report. The complete suite runs in Chromium, Firefox and
WebKit; see PR checks and the completion comment for final results and rollout
status.

Interactive local checks verify repaired previews at desktop and phone widths,
repositioning, viewer remounts, and a selected wall remaining highlighted after
stack/unstack rebuilds. No console errors or warnings were observed in those
checks. Native desktop Safari could not be repeated because the Mac was locked;
WebKit CI is separate from physical Safari/iPhone validation.

No Firebase Storage writes, server routes, quotas, rules or cloud retention
settings are added or changed. Ordinary editing, textures and photos retain the
local/cached asset design. The iPhone repository and package format are unchanged.

## Remaining work

Keep the resource regression fixtures passing. Broader performance work still
needs repeatable small/medium/large homes, measured frame-time and memory budgets
on actual desktop/phone hardware, and evidence before adjusting mobile quality
or replacing whole-scene rebuilds. Touch gestures, downloads/share sheets and
physical native device coverage remain open. See [NEXT.md](../../NEXT.md) and
[#30](https://github.com/laanlabs/openPlan3D/issues/30) for release and cost gates.
