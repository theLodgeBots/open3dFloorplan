# Local save conflicts — September 6, 2026

Issue #51 addresses older browser tabs silently overwriting a newer saved project
or recreating one deleted from the library. The entire library is stored in one
localStorage value, so different-project writes also need coordination.

## Changes

- Each browser document remembers the exact stored revision it opened or saved.
  Save compares that revision with current storage before writing. A changed,
  deleted or unexpectedly existing project raises a conflict and leaves both
  the saved library and in-memory work intact. Listing the library does not
  silently rebase an open editor. Library deletion checks the listed revision.
- Current tabs serialize library mutations under a shared Web Lock and reread the
  library inside the lock. A queued save freezes its data before waiting; later
  edits remain unsaved. A project reopened during the wait invalidates the old
  save. Failed writes do not advance the remembered revision.
- Storage events notify an open editor without replacing its plan. Conflicts
  retain JSON backup and expose Save as copy. Normal autosave pauses for a known
  conflict; an explicit retry still performs the revision check. Other-project
  changes do not disturb the active plan. The listener is removed on editor exit.
- Recovery copies are validated and saved with a fresh ID before switching the
  editor. Full storage leaves current work active and the recovery action
  available. Edits made while copying remain in the current tab, with feedback
  that another copy is needed for those later edits. Delayed thumbnail writes
  cannot overwrite previews belonging to a newer stored revision.
- Project-library action buttons now have accessible names and remain visible
  on touch layouts, making rename, duplicate and delete easier to find.

## Validation and compatibility

390 unit tests pass, including 23 new cases for separate store sessions, stale
saves/deletes, independent writes, queued immutable data, recovery, storage
notifications and preview protection. Five added browser workflows cover two-tab
desktop/390 px conflicts, JSON backup, failed copy recovery, deletion,
different-project writes and edits made while a real Web Lock delays copying.
The PR records final CI and interactive local/live browser results.

The coordination uses the browser's [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
and [storage events](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event).
Web Locks requires a supported secure context. Older browsers or insecure
self-hosted sites retain revision checks but lack coordination for simultaneous
writes. Tabs running an older app build do not participate in the new lock or
revision checks; refresh those tabs before editing the same plan concurrently.
This is conflict prevention and explicit copying, not collaborative editing,
automatic geometry merging or cross-device synchronization.

The file format and existing stored bytes are unchanged until an explicit save.
No Firebase Storage operations, hosted endpoints, iPhone schema changes or live
storage-rule changes are introduced. Issue #30's client distribution and billing
work remains separate.
