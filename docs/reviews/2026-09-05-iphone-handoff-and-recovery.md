# iPhone handoff and damaged-file recovery

This batch addresses the next reliability findings in the current-state roadmap.
The format and remaining fidelity limits are documented in
[handoff format v1](../handoff-format-v1.md).

## Web

- Preserve wall thickness/height, door styles, hinge/swing orientation, window
  styles/sill heights and fractional dimensions from iOS exports.
- Preserve source element IDs, intentional angles, all named floors and empty floors.
- Route toolbar, sidebar and hosted imports through the same project conversion
  and defaults. Toolbar imports create a new project containing every floor.
- Validate the complete capture before changing the current project; show errors
  in a dismissible editor banner. Reject ambiguous ZIPs and raw scans packaged
  beside edited plans, with guidance to use Editable Plan JSON.

## iPhone companion

- Export resolved opening style/orientation and sill height with a versioned marker.
- Add local Editable Plan JSON sharing, using the same payload as hosted handoff.
- Reject damaged arrays/typed fields and duplicate identities/floor indices;
  retain legacy defaults for absent fields and preserve unknown material/style strings.
- Keep intentionally empty edits. An unreadable edited file cannot silently fall
  back to a capture in the editor, previews, drawing export or hosted handoff.
- Offer explicit recovery with an exact local backup before opening the original
  scan. Failed recovery leaves the edited file untouched.

## Validation

- 162 web tests pass across 17 files, including 27 import tests. Type checks have
  zero errors and 25 existing warnings; production Node build succeeds; audit
  reports zero vulnerabilities.
- 36 iOS tests pass, including nine recovery/contract tests, on iPhone 17 Pro / iOS
  26.5 simulator. Both FloorPlan and openPlan3d simulator targets build.
- Matching fixtures in both repositories are checked against the actual Swift
  exporter and imported web geometry. Recovery tests read the actual backup bytes.
- Local production browser: toolbar JSON import shows Entry/Loft/Future Floor,
  four walls/four doors/two windows/one object on Entry, 27.5 cm wall thickness,
  273.5 cm wall height, 91.5 × 203.5 cm door, fixed window with 73.5 cm sill,
  angled Loft wall, Save/reload and stacked 3D.
- Final local browser checks also pass for malformed-file errors leaving the
  active project/floor intact, dismiss and valid retry, sidebar defaults, toolbar
  keyboard activation, raw ZIP import, and edited ZIP recovery guidance. Repeated
  2D/3D switches produce no console warnings or errors.
- Native simulator UI verified the failed-load screen, Retry, Recover Original
  Scan, successful Save and exact original-file backup retention. Recovery mode
  exposes only recovery actions to accessibility; editor controls are disabled
  and hidden until a complete plan loads.
- Post-merge live verification is recorded on the release PR. No physical device, LiDAR, Files/AirDrop delivery or live
  Firebase upload was exercised; no App Store/TestFlight release is included.

## Costs and remaining scope

Editing, validation, backups and file exchange remain local. Hosted handoff adds
only small geometry fields; no attachments, cloud autosave or hosted services are
introduced. Quotas, retention and billing work remain in issue #30.

Full bidirectional project exchange, attachment/notes/cost fidelity and accurate
cross-platform catalog mapping remain roadmap work. A full dataset ZIP continues
to retain native session content locally; the web requires geometry JSON for edits.
