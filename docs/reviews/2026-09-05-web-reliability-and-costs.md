# Web deployment, download, print and selection fixes

Implemented September 5, 2026 on `codex/web-reliability-and-costs`.

## Changes

- App Hosting now compiles with `NODE_ENV=production` and explicitly includes npm
  development dependencies during the build. CI exercises that install setting.
  Vite rejects development-mode production builds, preventing the previous
  `__sveltekit_dev` deployment from recurring.
- SvelteKit's version detection runs periodically while the page is visible and
  on return to an older tab, with a minimum one-minute interval between checks.
  An update notice offers saving and reloading. Unsaved editor navigation and
  explicit reload wait for a successful save of the current project revision;
  failure retains the editor and offers a local JSON backup. The backup code is
  loaded with the app shell so recovery does not depend on an export chunk still
  existing. A failed 3D import returns to 2D with recovery options.
- Import URL synchronization uses SvelteKit's `replaceState` and preserves its
  page state. A useful error page provides retry, backup and library navigation.
- Furniture thumbnails load as their catalog tiles become visible. Three.js
  thumbnail generation and model downloads no longer run on editor startup.
  Filtering reinitializes each preview so recycled tiles show the correct model.
- Models and textures are emitted under content-hashed immutable asset URLs.
  The existing Node adapter supplies a one-year public cache policy. A changed
  asset gets a new URL; unchanged assets retain their URLs across releases.
  Legacy static paths remain available. No user project data is put in this cache.
- Print Preview calculates centimetre-to-millimetre scale on A4/Letter in either
  orientation. Numeric scale remains fixed; oversized plans disable output and
  offer a smaller scale or explicitly labeled Fit to page. Preview and PDF share
  the same page rendering, including a calibration line. PDF room schedules use
  resolved room names and paginate. Print at Actual size / 100% to retain scale.
- Doors/windows use their rendered wall-aligned opening footprint, including the
  tangent of curved walls, plus a five-screen-pixel picking margin. Physical
  width is independent of zoom; later-drawn overlapping openings take priority.

No Firebase Storage policy or iOS source changed. Ordinary editing and backups
remain local. This batch addresses the download portion of issue #30; quotas,
retention decisions, budget administration and backend-level cost attribution
remain separate work.

## Validation

Clean `NODE_ENV=production NPM_CONFIG_INCLUDE=dev npm ci`, type checks, 110 tests,
production build and dependency audit passed. Type checks report zero errors and
25 existing warnings; audit reports zero vulnerabilities. An explicit
development-mode build fails with the new explanatory error. Production entry
artifacts contain no `__sveltekit_dev` marker.

Tests cover opening selection at five zooms, rotated/curved/degenerate walls,
overlap order, save failure/concurrent edits before reload, physical scale and
overflow, real PDF image placement in millimetres, and Vite asset emission with
stable hashes that change only when file contents change.

Browser checks used the actual Node production build, with temporary local HTTP
request logging and only synthetic projects:

| Scenario | Observed result |
| --- | --- |
| Baseline editor startup (`83096d6`, separate origin) | 94 GLB requests; 1,268,404 model bytes |
| New editor startup | Zero GLB requests |
| Opening the visible catalog | Seven distinct GLBs; 87,744 model bytes; eight visible previews (two share a model) |
| Reopening the catalog in a second tab | Previews rendered with zero additional model requests/bytes at the origin |
| Asset caching | Actual model GET responses use `public,max-age=31536000,immutable`; hashed texture and 3D model URLs load successfully |
| 3D | Synthetic furnished room renders after catalog browsing |
| Print | Preview renders; Letter portrait at 1:25 reports overflow and disables output; Fit to page reenables it |
| Print mathematics | A 10m wall is rendered as 200mm at 1:50; real PDF page/image dimensions verified by automated tests |
| Local storage failure | A disposable 6 MiB description exceeds browser quota; navigation and Save-and-reload both stay in the editor with the plan intact and backup options visible |
| Subsequent small import | Replaces the synthetic oversized project, updates its URL and saves normally; existing saved projects remain in the library |
| Update notice | Simulated version change is detected; navigation offers reload; saved project survives returning to the library |
| Missing bundle during rollout | Temporary server returns one 404 for the editor chunk and reports a changed version; browser requests the version, performs a full editor navigation (200), fetches the chunk successfully and opens the same saved project ID |
| Wide opening selection | Clicking 140cm inside the room selects the room instead of the 300cm doorway; clicking the doorway edge selects the door with its full width |

Network measurements describe these local scenarios, not the project-wide bill or
all browser traffic. The baseline and new editor checks establish model transfer
changes; total page-byte comparisons also depend on the selected plan and textures.

Limitations: PDF download invocation produced no browser console errors, but the
browser tool's download event timed out, so completed file delivery is unverified.
Its requested 390×844 viewport also remained 1280×720, including a fresh tab;
phone-width coverage is therefore not claimed. Physical printing, actual touch,
Safari and Firefox remain outside this run. Rollout recovery was tested with a
controlled local missing-bundle/version-change simulation; a production rollout
still needs its normal post-release smoke check.

## Repeatable browser checklist

1. Build and serve the Node output. Import
   `tests/fixtures/opening-plan.openplan.json` using Export → Import JSON.
2. At multiple zooms, select the wide doorway/window near their ends and click
   well inside the adjacent room. Confirm only the opening itself captures its
   clicks. Exercise angled/curved-wall fixtures in the unit suite.
3. Import `tests/fixtures/interaction-plan.openplan.json`. Open Objects, filter,
   scroll, switch to 3D, then save/reopen. Compare model GETs on initial editor
   load and cold/warm catalog use.
4. Open Export → Print Layout. Compare 1:50/1:100, both page sizes/orientations and
   a deliberately overflowing 1:25 plan. Download the PDF and measure the
   calibration line at Actual size using a known-length fixture.
5. On an isolated local origin, import a copy of the interaction fixture with a
   distinct ID and a 6 MiB description. Verify failed-save recovery before
   navigating/reloading. Replace it with the small fixture to finish the test.
6. Use a temporary local proxy to retire one unvisited editor bundle while
   returning a different `/_app/version.json`, then navigate from the library.
   Confirm recovery preserves the newly saved project ID. Never inject this
   failure or upload oversized fixtures into production.
