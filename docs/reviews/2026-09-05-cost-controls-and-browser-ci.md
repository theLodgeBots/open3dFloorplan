# Cost controls and production-browser regression checks

Reviewed September 5, 2026. Related to web PR #38, companion PR #4 and cost issue #30.

## Download reduction

Twenty bundled textures were converted with `cwebp -q 82 -m 6 -metadata none`,
retaining the original pixel dimensions and CC0 source artwork. Combined size
falls from **23,860,994 to 3,662,272 bytes (84.7%)**. Light oak falls from
892,211 to 99,336 bytes (88.9%). Original JPEGs are removed from the deployment;
all material/preview references use the replacement WebPs through the existing
content-hashed asset pipeline. Per-file measurements are in
[texture-bytes.json](2026-09-05-texture-bytes.json).

The converted oak and detailed porcelain images were visually inspected. The
local production browser also rendered the imported furnished plan in 3D without
console warnings/errors. Production cache/header verification follows rollout
and is recorded on the release PR.

## Browser CI

GitHub Actions builds the actual Node production app and runs three Chromium
checks with one worker. Tests use fresh profiles, synthetic fixtures and no cloud
credentials. Analytics and hosted uploads are disabled explicitly. The core
editing workflow asserts that it makes no external HTTP requests.

Coverage includes toolbar import using Enter, a numeric wall edit, undo/redo,
project naming, complete JSON export, selected empty-floor persistence after
Save/reload, malformed-input rejection without changing exported project bytes,
sidebar retry and geometry-preserving defaults. Catalog filtering, stacked 3D,
return to 2D, immutable GET headers, lazy model loading and warm cache reuse are
also checked. A third test verifies sharing fails closed when unconfigured.
Failure screenshots/traces and the HTML report remain on GitHub for seven days.

Measured on CI at `4b9cc96`, viewport 1440×900:

| Scenario | Observation |
| --- | --- |
| Empty editor startup | 20 recorded subresources / 259,211 transferred bytes; zero GLBs |
| Visible catalog | 11 model responses / 157,312 model bytes |
| Startup + fixture import + catalog + 3D | 37 recorded subresources / 692,382 transferred bytes |
| Reload + 3D with a warm cache | 24 recorded subresources, all with zero transferred bytes; oak/model decoded bytes still present |

These Resource Timing values describe the tested subresources, excluding the
HTML navigation itself. They are not a total-page zero-byte claim or a forecast
of project-wide billing savings. The report contains exact resource entries and
the stacked-3D screenshot. Touch/drawing gestures and physical devices still need
separate interactive checks.

## Quota endpoint and companion

The existing web backend now has a staged `/api/handoffs` upload endpoint, with
1 MiB per capture, 100 reservations / 25 MiB per UTC day, and 10 reservations per
minute. A private zero-byte metadata ledger uses generation/metageneration
preconditions across instances. Malformed, oversized and stalled requests are
rejected before admission; unavailable/contended storage fails closed. Failed
capture writes retain their reservations. No new database, function, IAM grant
or service-account key is introduced. Normal admitted uploads add a metadata
read/write; requests and downloads still incur costs.

The companion hashes canonical JSON, coalesces concurrent identical sends and
persists a bounded cache of hashes/codes/expiry without plan contents. Unchanged
valid shares survive app restart; changed plans/options or expired codes upload
again. Limits and failures offer local Editable Plan JSON export, with no
application-level automatic retries. Temporary-link language avoids promising
an exact deletion time.

**Legacy direct Storage creates remain enabled for distributed older clients.**
The new endpoint's quota therefore does not yet impose an aggregate bucket cap.
The [migration contract](../handoff-quotas.md) explains the release gate and
`ops/storage-quota-cutover.rules`. The candidate passed seven Firebase Rules API
tests (valid/legacy reads allowed; direct create/update, ledger access and listing
denied). Testing did not deploy or activate the candidate. No iPhone distribution
release is included.

## Live usage and retention decision

A metadata-only inventory found 133 live inbox objects / 10,897,346 bytes and
557 soft-deleted copies / 55,745,162 bytes. No user capture contents were read.
The bucket's root contained only `inbox/`; the existing one-day prefix lifecycle,
seven-day soft delete and versioning-off settings were reconfirmed.

All pages of the App Hosting response-byte metric were collected for September 1
00:00 UTC through September 5 21:33:44 UTC. Summing daily-aligned series by backend
reported 67,492,060,612 bytes for `openplan3d` and 8,711,777,861 for
`openplan3d-www`. This is response-byte telemetry, not an invoice; reporting can
lag. It distinguishes the editor from the separate website and supports
prioritizing download efficiency.

Keep the existing recovery policy for now. The observed retained storage is
small, and reducing it would remove a recovery option for future deletions.
No lifecycle, soft-delete or bucket recovery settings were changed. Reassess
retention after client migration and against the agreed budget.

The account can administer the project but cannot read billing-account IAM.
The Budget API is not enabled for this project; no API was enabled, budget
created or alert verified. A billing administrator and a monthly target remain
necessary. Budget alerts do not enforce a spending cap.

## Validation

- 180 web unit tests pass, including 18 new admission/transport tests.
- Three production-browser CI checks pass; zero type errors and 25 existing
  Svelte warnings; production build succeeds; dependency audit finds zero
  vulnerabilities.
- 43 iPhone simulator tests pass, including six new upload/cache tests. Both
  FloorPlan and openPlan3d simulator targets build.
- Seven cutover-rule cases pass against the Firebase Rules test API without
  changing the active release.
- Final live endpoint, browser, native sharing and deployment checks are recorded
  on the PR after rollout. This report does not claim full quota enforcement,
  a dollar spending cap, a physical-device capture test or an App Store release.
