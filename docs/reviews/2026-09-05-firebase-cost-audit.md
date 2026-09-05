# Firebase deployment and cost audit

Reviewed September 5, 2026 through the signed-in Firebase and Google Cloud consoles.
This completes the configuration portion of the read-only audit proposed in the
[roadmap](2026-09-05-current-state-and-roadmap.md). No bucket settings or stored
captures were changed, and no individual capture contents were opened.

## Confirmed deployment

The `openplan3d` App Hosting backend in `us-east4`, serving `app.openplan3d.com`,
reports a successful live rollout of `5d530e2` (PR #28), released September 5 at
12:05:26 PM EDT. This corroborates the earlier live browser checks. The separate
`openplan3d-www` backend has its own rollout and was not changed in this work.

[Issue #29](https://github.com/laanlabs/openPlan3D/issues/29) remains open for the
production-build environment and navigation failures across rollouts. A successful
rollout does not resolve the previously observed stale-client failure.

## Confirmed capture bucket configuration

| Setting | Observed value |
| --- | --- |
| Bucket | `openplan3d.firebasestorage.app` |
| Location / class | `us-east4` / Standard |
| Lifecycle | Delete objects aged at least one day with prefix `inbox/` |
| Soft delete | Enabled, seven-day retention |
| Object versioning | Off |
| Bucket retention policy | None configured |
| Object retention | Not enabled |
| Default event-based hold | Disabled |
| Deployed Firebase rules | Match the repository's `storage.rules` conditions |

The deployed rules allow public reads of matching inbox filenames and create-only
JSON uploads smaller than 10 MiB. Overwrites and client deletes are denied, as are
all other paths. These per-object conditions do not enforce an aggregate upload
or download budget.

Lifecycle deletion is asynchronous. After deletion, seven-day soft-delete recovery
continues to retain billable copies. Changing that policy affects future
deletions; previously soft-deleted objects keep their original retention. See
[lifecycle behavior](https://docs.cloud.google.com/storage/docs/lifecycle) and
[soft-delete behavior and costs](https://docs.cloud.google.com/storage/docs/soft-delete).

The iOS source reads `plan.json` or `room.json` from `Documents/Sessions` before
creating a JSON handoff. Sending does not remove those originals. This supports
considering no soft-delete retention for reproducible temporary transfers, provided
the bucket remains dedicated to that purpose. This source inspection does not
establish backup or recovery behavior on a physical device.

## Cost evidence and limits

- Firebase's September project-cost breakdown attributes most reported cost to
  App Hosting. Its outgoing bytes have already exceeded the displayed monthly
  no-cost allowance. Prioritize download efficiency alongside Storage retention.
  The project contains two App Hosting backends; this project-level total does
  not attribute all usage to the editor.
- The bucket's 30-day observability chart contains both live and soft-deleted
  storage series. Its plotted range reaches approximately 94.5 MiB. That chart
  maximum is not a current retained-byte total or a billing measurement.
- Firebase Storage's usage page reported “No data” for bytes, object count,
  bandwidth, and requests. These values remain unavailable, rather than zero.
- The project cost display can lag by 24 hours. A complete Storage cost and
  request/download breakdown was not available from the inspected reports.
- The account can view project costs but the console explicitly denies access
  to billing-account details and budget alerts. Existing budget settings remain
  unverified; no budget was created or modified.

App Hosting charges include outgoing bandwidth even when cached; caching can
reduce origin work but reducing transferred bytes also matters. See
[App Hosting costs](https://firebase.google.com/docs/app-hosting/costs).
Budget alerts provide notification, not a spending cap. See
[Firebase billing guidance](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills).

## Prioritized follow-up

Tracked in [issue #30](https://github.com/laanlabs/openPlan3D/issues/30).

1. **Reduce App Hosting downloads.** `BuildPanel.svelte` generates every mapped
   furniture thumbnail on mount, which loads the associated GLB even before the
   object catalog is opened. Compare lazy, visible-item loading with small
   pregenerated thumbnails. Measure initial editor, catalog, and 3D transfers
   with an empty and a warm browser cache before choosing the implementation.
2. **Make static-asset caching explicit.** Production HEAD probes of
   `/textures/floor-light-oak.jpg` and `/models/kitchenFridgeSmall.glb` both returned
   200 with an ETag, no `Cache-Control`, and `cdn-cache-status: miss`. The texture
   response advertised 892,211 bytes. These two HEAD samples do not establish
   the cache-hit rate for normal GET traffic. Verify actual GET behavior, use
   versioned asset URLs before assigning long-lived cache headers, and assess
   smaller texture variants. Keep personalized content out of shared caches.
3. **Decide temporary-copy recovery.** The concrete candidate is to retain the
   one-day `inbox/` lifecycle and disable soft delete on a bucket dedicated to
   handoffs. Bucket-wide recovery would then be unavailable for future deleted
   copies. Isolate temporary transfers first if durable data will share this
   bucket. No policy change was made during this audit.
4. **Bound hosted handoffs.** Preserve local editing/file exchange, add enforced
   upload admission and rate quotas before expanding public hosted features,
   and reuse unchanged handoffs while valid. Keep images and raw capture bundles
   out of the default transfer.
5. **Set an operating budget.** A billing administrator should confirm current
   alerts and an acceptable monthly target, then monitor Hosting bandwidth,
   live/soft-deleted Storage bytes, requests, and supporting services together.

Acceptance: ordinary edits make zero Storage requests; catalog opening and 3D
still work after lazy loading; repeated asset GETs demonstrate the intended cache
behavior and updates do not serve stale assets; retention changes are verified
with disposable captures; measured usage is compared with the agreed budget.
