# Local library backup restoration — 2026-09-06

The library and welcome screen now offer a restore dialog for version 1 `openplan3d-library` bundles and older raw project-map JSON backups. Choosing a file only validates and previews it. The dialog shows restorable projects, usable version counts, damaged entries and retained recovery data before the user chooses Restore as copies.

Every restored project gets a fresh ID and a “Restored copy” name. Existing entries are never replaced, including source-ID collisions, reserved names and damaged records. Restoring never loads a project into the active editor or changes its undo history. Each usable snapshot is validated and rebound to its restored project's ID; the latest ten valid versions are retained. Embedded project images and unknown native metadata survive. Library previews accept embedded raster image URLs; unsupported previews remain recovery data.

All project, preview, history, recovery-record and legacy-migration writes commit together. Quota failures, cancellation and transaction aborts roll the entire operation back. A preview shares one pending restore and remembers successful completion, avoiding duplicate restores when clicked repeatedly or when the library refresh later fails. Cancelling a file read, choosing a newer file or leaving the library cannot apply stale results.

A damaged destination legacy map is retained byte-for-byte while the explicit restore transaction records its migration baseline. A failed restore also rolls that baseline back. Individually unreadable saved project records remain visible and deletable without hiding healthy/restored projects; opening still validates them and backups retain their raw strings.

Damaged/unrestored project and history strings, orphan previews/history, and legacy or unknown bundle metadata are retained as flat `library-recovery:` metadata records. Current library backups include these raw strings in an optional `recovery` map. Prior recovery records are carried forward without recursively nesting full backups, and conflicting archive IDs are preserved independently. Recovery-only backups can be kept even when no project is usable. The original selected file remains downloadable from the dialog. Legacy data and recovery archives are not automatically reactivated as projects.

The editor stays local: no Firebase uploads, server endpoints, database version bump, production dependency or iPhone changes are introduced. Other open tabs should be refreshed so future full-library exports include retained recovery records.

Validation: 435 unit tests pass, including rollback at every persistence stage, post-request aborts, snapshot remapping, duplicate/reserved IDs, corrupted source/destination data, archive collisions and a project over 6 MiB. Type checking has zero errors and the same 23 existing warnings; production build passes. Browser regression additions cover desktop/390 px preview and restore, history restoration/reload, quota retry, cancellation with another editor open, damaged destination recovery and large legacy-file restoration. CI and live verification are recorded on the PR.

Manual browser check: restored the usable project from a mixed valid/damaged fixture through the welcome screen, verified the 390 px preview and success dialog, and confirmed the independent project appeared in the library.
