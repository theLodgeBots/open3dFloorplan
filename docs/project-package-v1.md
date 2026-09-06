# Local project packages, version 1

Choose **Download project package** from the web editor's Export menu, or **Export Project Package (ZIP)** in the iPhone review screen. Import using **Import project package** in the web library/welcome screen or **Import Project Package** on iPhone's Home screen. A preview appears before an independent copy is added. Files can be transferred through Files, AirDrop, local downloads or other user-selected file transport; the app never uploads a package to Firebase.

This format carries the current edited plan and its attachments. Full-library backups remain the separate format for all web projects and version histories. Raw iPhone capture datasets remain separate; a dataset with an edited `plan.json` cannot silently reopen the older `room.json`.

## Contents

A flat, versioned package has these entries:

| Path | Meaning |
| --- | --- |
| `manifest.json` | `{ "format": "openplan3d-project", "version": 1, "producer": "web" or "ios", "title": "…" }` |
| `plan.json` | Current native iPhone `PlanDocument`, in metres; original unknown fields retained |
| `web.json` | Optional original web project, in centimetres, with its native IDs/unknown fields; never embeds `projectPackage` recursively |
| `baseline.json` | Required with `web.json`: the native projection at the last web export, plus optional tracing-image floor/checksum metadata |
| `mapping.json` | Required with `web.json`: `entries` maps native UUIDs to the original web element/floor IDs |
| `assets/<relative filename>` | Referenced photos/tracing image and retained original attachment bytes |

All three web-return files must occur together. Web exports always include them. Native exports preserve them byte-for-byte while replacing `plan.json` with the current edits. Native import retains the original JSON separately from normal editor saves, so unknown fields survive; recognized fields that the user clears are removed when exporting again.

The web stores a flat `projectPackage` extension on the imported project containing the latest native source, identity map and base64 attachment bytes. Local project JSON and full-library backups retain it. The next package export removes this extension from `web.json`, preventing recursive snapshots. Native storage keeps retained files under the session's `.openplan-package` directory. Retained original attachments may include files no longer shown by the receiving editor; both export interfaces disclose this.

## Fidelity and editing limits

Shared edits include wall endpoints, thickness and uniform height; door/window geometry and common styles/orientation; furniture placement, angle and footprint; floor names; room names/label positions/colors; plan notes and placed text; and the first floor's supported tracing image. Element mappings preserve identities across moves and IDs that are not native UUIDs. Unit conversion retains fractional dimensions.

Web returns compare the current native projection with its saved baseline and apply only changed shared properties to `web.json`. Unchanged web fields therefore survive, including floor elevations, curves, sloped wall heights, textures, stairs, columns, dimensions, groups, custom imagery, mirrored/scaled furniture and unknown extensions. A changed native wall height sets both endpoint heights on return. Furniture footprint changes account for existing web scale/mirroring. Unknown native materials/styles and other fields remain in the native source. Unchanged native defaults and pin-vs-styled-label choices remain unchanged on web return exports.

The catalogs and feature sets are not yet identical. iPhone displays straight, uniform-height walls and simplified furniture; it does not edit web floor elevations, wall curves/slopes, arbitrary web opening styles or web-only annotations. Unsupported furniture uses a basic web preview while retaining its original native category. Room labels without a detected enclosure remain preserved, though the web cannot draw an enclosed room fill for them. Photos, per-item notes, prices, room ceiling overrides and material metadata remain available on iPhone and in the package; equivalent web editing controls are follow-up work. The import previews disclose these limits.

Only one unrotated PNG/JPEG/GIF tracing image (the first web floor) is mapped to the native underlay. Other floor images, rotation, opacity and locking remain in the web source. Changed native placement/width updates the corresponding web image while preserving its presentation settings. Unsupported native image formats remain attached for iPhone without a web preview. Active web images must be embedded raster data; external/blob/SVG references are rejected before package import/export rather than fetched. No model or attachment is uploaded as part of exchange.

## Validation and persistence

The ZIP profile follows [PKWARE's ZIP specification](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT), using stored regular files with CRC32, one disk, UTF-8 names, and no data descriptors, extra fields, ZIP64, comments, encryption or compression. This intentionally narrow profile is generated by both clients without adding a production dependency. General third-party ZIP repackaging is unsupported; export a new package from OpenPlan3D.

Both readers enforce 64 MiB total, at most 512 entries, 32 MiB per JSON document and bounded nesting. They reject duplicate JSON keys (including escaped spellings), case-insensitive duplicate paths, traversal, file/directory collisions, symlinks, reserved session filenames, inconsistent local/central headers, bad CRCs, unsupported versions and missing required attachments. Native plans need finite valid dimensions, unique identities and valid opening parents. Coordinates and dimensions are bounded to 10,000 metres, wall thickness to 10 metres, floor indices to ±1000 and angles to ±100,000 radians before drawing; the plan contains at most 5000 mapped elements/floors. Identity maps cannot contain duplicate native or target identities. Broken web-return data is never silently treated as a fresh native capture.

Web preview performs no persistence or editor changes. Import uses the existing atomic multi-store restore transaction, with a fresh project ID and an Imported copy name; quota failure/cancellation rolls the batch back. Native import stages all session files under a hidden temporary directory, then publishes the complete session by renaming it. Cancellation or write failure removes staging and leaves existing sessions intact. Success is recorded before a later library refresh, so a refresh failure does not offer to duplicate the import.

## Contract fixtures and release verification

Matching `native-project-package.zip` and `web-project-package.zip` fixtures live in both test suites. Native XCTest imports the real web package, edits it, and exports a `swift-return-project-package.zip` attachment. The web suite imports that actual Swift output and asserts both edits and retained web-only data. Additional tests cover unknown fields, attachments, deleted metadata, cross-floor moves, tracing placement, quota retry, cancellation, corrupt archives and independent copies. Browser CI covers desktop/390 px import, edit/save/reload, ZIP export and 3D with no external network requests.

Simulator builds/tests validate code and local persistence. Physical-device Files/AirDrop delivery, LiDAR capture, and App Store/TestFlight distribution remain explicit release work in [issue #30](https://github.com/laanlabs/openPlan3D/issues/30). This format does not change upload quotas, Storage rules, billing configuration or native distribution status.
