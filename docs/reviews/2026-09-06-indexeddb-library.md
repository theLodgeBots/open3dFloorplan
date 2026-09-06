# IndexedDB local library — 2026-09-06

## Behavior

Projects (including embedded images), previews and version history now live in separate IndexedDB object stores. Each save updates one project record. Browser transactions compare the revision and commit the write atomically, including browsers without Web Locks. The editor reports Saved only after the transaction commits. Previews remain optional and history retains its ten-version limit without destructive quota retries.

The first access imports the legacy project map, previews and raw history together. Migration failure rolls back all records and its marker; retry starts from the untouched original localStorage bytes. This release deliberately retains that original storage for recovery. It is no longer updated by new saves. A small optional localStorage signal notifies other tabs; saving and focusing also verify persisted revisions.

Tabs running the previous release can continue writing the old library. A changed valid old project appears as a separate “Recovered from older tab” project. Further old-tab edits update that recovery copy only while its current saved bytes still match the last recovery; editing or deleting the copy makes subsequent recovery independent. Old deletes never erase or resurrect current projects. Close or refresh older tabs after upgrading. Invalid old-project bytes remain in the legacy portion of the library backup.

Version reads and restore are asynchronous. Restore verifies the selected snapshot and refuses to replace work edited while the read was pending. History errors remain visible after reopening the panel until a successful retry or clear.

## Backups and limits

Download library backup is available in the library and during recovery. The version 1 `openplan3d-library` JSON bundle contains raw per-project strings under `projects`, per-project `thumbnails` and `history`, and original/previous/current legacy storage snapshots under `legacy`. Corrupt legacy libraries that could not migrate are downloaded byte-for-byte in the original format. Recovery bypasses migration/geometry validation. Individual project JSON import/export continues unchanged; a whole-library bundle requires extracting a project's JSON string into a `.json` file for the existing importer. One-click whole-library restoration is follow-up work.

No Firebase upload, paid storage, schema change to the iPhone handoff, or cloud setting is introduced. IndexedDB still uses browser-managed storage; it is not an off-device backup. Embedded images remain inside each project's JSON (and snapshots), so blob deduplication and more efficient metadata-only listing remain possible follow-ups. This release retains the bounded existing legacy data instead of automatically clearing it.

## Verification

- 403 unit tests pass, including full migration rollback/retry, commit abort after request success, concurrent clients, late old-release recovery, reserved IDs, histories and a project exceeding the old localStorage quota.
- Type checking: zero errors; 23 pre-existing warnings. Production build passes. npm audit: zero vulnerabilities.
- Browser suite now targets actual IndexedDB writes/reads for all existing import and conflict regression checks, with added migration, rollback/retry, large local project and older-release recovery cases. GitHub CI and release verification are recorded in the PR.
- Manual upgrade test: imported and manually saved a project in the previous production build, then opened the new build on the same origin. Its project, preview and previous manual/session history remained available.
