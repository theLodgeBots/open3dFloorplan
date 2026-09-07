# Next work and pause handoff

Updated September 6, 2026. This is the current backlog for the web app and iPhone
companion. It supersedes the historical “next” sections in the
[original review and batch log](docs/reviews/2026-09-05-current-state-and-roadmap.md).
Priorities below are proposed order, not release dates or a claim of complete
Planner 5D parity.

## Saved baseline

- Web implementation is merged and pushed to `main` at `e812ecf`
  ([PR #62](https://github.com/laanlabs/openPlan3D/pull/62)). Furniture colors,
  finishes, placement previews and lazy model/resource handling are repaired.
  See the [rendering report](docs/reviews/2026-09-06-furniture-rendering.md).
- Companion implementation is merged and pushed to `main` at `54f4326`
  ([iOS PR #6](https://github.com/laanlabs/openplan3d-ios/pull/6)). Local project
  packages and the shared metadata contract are implemented. This is source
  availability, not a TestFlight/App Store release.
- Both working trees were clean and had only the local `main` branch when this
  handoff was prepared. All implementation PRs are merged; no PR is open in
  either repository. The only open web issues are **#63 and #30**; there are no
  open companion issues. Documentation commits follow the implementation hashes
  above.
- Last implementation validation: **482 web unit tests, 53 browser tests**, audit,
  type checks and production build passed; type checks retain **23 existing
  Svelte warnings and zero errors**. Both
  [PR CI](https://github.com/laanlabs/openPlan3D/actions/runs/34074100614) and
  [main CI](https://github.com/laanlabs/openPlan3D/actions/runs/34074484516) passed.
  Latest native validation: **51 XCTest tests passed** on iPhone 17 Pro / iOS 26.5
  simulator. Latest web changes were also checked in the live browser at desktop
  and phone widths. Phone-width browser checks do not replace physical iPhone QA.

Already delivered: storage safety and recovery; connected editing and numeric
dimensions; named-room exports and physical PDF scale; dependency remediation;
floor elevations and sloped walls; direct AI provider configuration; safe imports
and project switching; local tab conflict recovery; IndexedDB migration; full
library backup/restore; two-way local iPhone/web packages; editable item
notes/photos/costs and pooled attachment history; furniture appearance fixes.
Do not reopen these as unimplemented roadmap items without a new reproduction.

## 1. Next engineering batch: furniture category continuity

Track in [#63: Map iPhone and web furniture categories faithfully without changing
retained identities](https://github.com/laanlabs/openPlan3D/issues/63).

**Confirmed defect:** package imports accept an exact web catalog ID or fall back
to `chair`. Native categories such as `bed`, `refrigerator`, `sink` and
`washerdryer` can therefore look like chairs. In the other direction, native
glyphs recognize generic categories while web packages can contain `bed_queen`
or `fridge`. The RoomPlan JSON importer has a separate, partial mapping.

- Define explicit shared category/alias fixtures and display mappings for both
  clients. Reconcile `washerDryer`/`washerdryer`, bed sizes, tables, sofas and
  appliances. Audit the existing stairs-to-storage mapping too.
- Preserve original category, stable IDs, fractional dimensions, transforms,
  metadata and unknown fields in unchanged returns. The current native export
  special-cases the `chair` fallback; changing only the import lookup would risk
  rewriting native identities on export.
- Use appropriate existing models/glyphs for known categories and an honest,
  distinguishable fallback for unknown ones. Mapping must not download all models
  at startup or introduce Firebase uploads.
- Acceptance: actual Swift ↔ web package fixtures cover beds, refrigerators,
  sinks, washer/dryers, sofas and unknown categories; 2D/3D previews, edits,
  save/reload and return exports preserve identity and dimensions.

Start in `src/lib/utils/projectPackageBridge.ts`,
`src/lib/utils/roomplanImport.ts`, and the companion's
`openPlan3d/Utilities/FurnitureSymbol.swift`, `Views/PlanEditorView.swift` and
`Views/RoomPreviewView.swift`. Keep the
[package contract](docs/project-package-v1.md) current in both repositories.

## 2. Release and Firebase cost gates

Keep [#30](https://github.com/laanlabs/openPlan3D/issues/30) open until all three
remaining gates are verified:

1. **Ship and test the updated iPhone client.** Prepare TestFlight/App Store
   distribution; exercise Files/AirDrop package exchange and real LiDAR/AR
   capture on physical devices; establish older-client compatibility requirements.
2. **Migrate clients, then cut over Storage rules.** Legacy public direct creates
   are still enabled. The staged admission endpoint has quotas, but this bypass
   means there is **no aggregate bucket cap yet**. After migration, deploy the
   reviewed candidate and verify anonymous creates/private ledger access are
   denied while admitted writes, valid links and local file exchange work.
   Candidate rule tests passed; active rules have not been cut over. Follow
   [the migration procedure](docs/handoff-quotas.md), including updating committed
   `storage.rules` so later deployments cannot reopen the bypass.
3. **Agree a monthly budget with a billing administrator.** Include Storage,
   both App Hosting backends and supporting services. Configure/verify alerts;
   the audit account lacks billing-account access and the Budget API was disabled
   at the audit. Alerts notify; they do not enforce a spending cap. Recheck current
   telemetry and retained bytes before changing quotas or retention.

Preserve the low-cost design: ordinary editing, history, backups, photos and full
project-package exchange stay local. Reuse bundled, cacheable catalog assets and
unchanged temporary shares; keep downloads lazy. The endpoint currently bounds
captures to 1 MiB, 100 reservations or 25 MiB per UTC day, and 10 reservations per
minute. Failed writes retain reservations. These limits do not cap downloads or
total spending. Keep the audited one-day inbox lifecycle and seven-day soft delete
unless new measurements justify a reviewed change. Avoid adding a database,
durable cloud copies, sync or media uploads without a cost model and enforceable
quotas. See the [cost audit](docs/reviews/2026-09-05-firebase-cost-audit.md) and
[cost/browser report](docs/reviews/2026-09-05-cost-controls-and-browser-ci.md).

## 3. Remaining quality and fidelity work

These are follow-up work areas, not claims that every item is a reproduced bug.

- **Browser and device coverage:** expand the Chromium CI suite to Firefox and
  WebKit; test actual iPhone/iPad touch, gestures, downloads/share sheets,
  storage/quota recovery and desktop Safari. Exercise native denied camera access,
  interruption/backgrounding, long scans, multi-floor work and attachment-heavy
  saves. Run a first-room usability session with unfamiliar desktop/iPhone users.
- **3D resource/performance audit:** investigate selected-wall highlight material
  clones being replaced without explicit disposal, and the separate camera-preview
  renderer lacking explicit teardown in `ThreeViewer.svelte`. These are source
  observations; quantify memory/context growth before calling them confirmed user
  failures. Add a repeatable small/medium/large-home benchmark, agreed desktop and
  phone frame-time/memory targets, and measured mobile quality settings. Consider
  updating changed objects instead of rebuilding whole scenes.
- **Area/geometry agreement:** define whether area is measured at interior wall
  faces or another boundary, reconcile native raster-based areas with web polygons,
  and test room split/merge identity and schedules. Matching area totals are not
  yet an established cross-platform guarantee.
- **Building completeness:** implement slabs, stair voids and common roof forms.
  Floor elevations and variable endpoint wall heights already exist. Extend native
  editing/preview fidelity for curves, slopes, elevations, opening styles and
  annotations while retaining unsupported data through package returns.
- **Known package presentation limits:** native previews still use straight,
  uniform-height walls and simplified furniture; only one unrotated first-floor
  embedded PNG/JPEG/GIF tracing image maps to the native underlay. Other imagery
  settings remain retained. Unenclosed native room labels are preserved without
  web room fill. Room ceiling overrides travel as metadata; web wall heights
  continue to govern 3D geometry. Broaden these capabilities deliberately with
  preservation tests. Original unsupported attachment formats remain downloadable;
  web photo previews are bounded JPG/PNG. See the package contract for exact limits.
- **Catalog and rendering quality:** maintain a catalog manifest with source/license
  attribution, real dimensions, scale/origin and platform support. Curate complete
  room sets, improve native furniture visuals, and refine materials, lighting,
  cutaway/dollhouse views, framing, saved cameras and deterministic render/export
  quality. Current finishes are visual controls, not physical material simulation.
- **Localization and usability:** revive English/Portuguese localization from
  closed community [PR #15](https://github.com/laanlabs/openPlan3D/pull/15) as a
  focused string-system change. Recheck first-use navigation, dense toolbars,
  readable labels, accessibility and touch property editing. Earlier interaction
  fixes are already merged; reproduce any remaining problem before changing them.

## 4. Longer-term Planner 5D parity

- Controlled local custom GLB/model import and bounded texture assets, then other
  formats as justified; retain provenance, size limits and safe failure behavior.
- Editable floor-plan recognition, scan repair and layout assistance with results
  users can review. AI images remain separate from authoritative measured geometry.
  Direct AI providers already exist; do not revive the unrestricted hosted proxy
  from the original community proposal.
- Read-only sharing, optional account-backed sync, comments/permissions and
  concurrent editing with explicit offline/conflict/recovery behavior. These are
  not implemented cloud features. Start only after the cost gates above; consider
  self-hosting/user-supplied storage for durable large libraries.
- Consistent room schedules, quantity budgets, shopping lists and moodboards.
  Existing item notes/photos and entered costs provide the starting data.

## 5. Repository and release maintenance

- Replace stale `FEATURES.md` and comparison checklists with a tested capability
  matrix. Refresh README counts/import features and add contributor guidance,
  fixture-oriented issue/PR templates and a release checklist. Historical review
  findings and original package metadata are not authoritative current status.
- Reduce the 23 existing Svelte warnings with focused accessibility/component
  changes. Review the CI artifact-upload action's Node 20 deprecation warning and
  update its pinned supported version; current checks pass. Continue dependency
  auditing rather than treating the original resolved advisories as still open.
- Decide whether to publish/license the currently private iOS repository, add a
  root contributor README, and clarify the two native targets/release branding.
  Review the current iOS 26.2 minimum before distribution; lowering it requires
  an API-availability audit and device testing. These are product/release decisions.

## Resume checklist

1. Fetch both repositories and confirm clean `main` against `origin/main`; reread
   #63 and #30 for updates. Start the next focused `codex/…` branch from current
   main. There is no unfinished implementation branch to recover from this pause.
2. Start with #63 and real cross-platform fixtures. Preserve unknown fields,
   explicit clears, independent import copies, fractional transforms and pooled
   local attachments. Do not rely on temporary QA directories as source artifacts.
3. Web baseline: Node 24/npm; run `NODE_ENV=production npm run check`,
   `NODE_ENV=production npm test` and `NODE_ENV=production npm run build`.
   Production browser workflows run in GitHub CI with cloud uploads/analytics
   disabled. Use the approved browser-control tools for local interactive QA.
4. Native baseline: `openPlan3d.xcodeproj`, scheme `FloorPlan`, Debug simulator
   tests with `CODE_SIGNING_ALLOWED=NO`. Select an available simulator; rerun
   actual native return-package fixtures when the contract changes. Complete
   physical-device release checks separately.
5. Keep documentation/issues aligned with results, merge only after relevant
   checks, verify deployment for application changes and remove merged branches.
   Browser QA projects are local browser data, not source-controlled project files.
