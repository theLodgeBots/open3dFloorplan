# Safe project opening — September 6, 2026

Issue #49 addresses valid imports and new-project actions replacing the current
plan before its pending autosave completed. Reimporting a native file with an
existing ID could also overwrite that saved library entry.

## Behavior

The toolbar, RoomPlan sidebar, welcome screen and project library now use one
project-opening service. It validates the candidate before any write, saves
pending current work, then checks that no newer edit or project switch arrived
during preparation. A failed current save leaves that plan active with backup
and retry feedback. Invalid imports still leave all current state and stored
bytes untouched.

An existing destination ID opens as a separate imported copy, retaining the
file's floors, geometry and extension metadata. The existence check does not
decode the old entry, so damaged saved entries remain available for recovery.
The file object is not mutated. Copies get a fresh project ID and creation time;
their floor and element IDs remain unchanged. Explicit version restoration keeps
its existing same-project behavior.

The newest opening request wins; late reads and failures from earlier requests
are ignored. Component teardown cancels pending reads before they can replace
work after navigation. New Project uses the same save protection and the editor's
existing SvelteKit URL synchronization.

Saved library previews wait for the canvas to redraw and fit the new plan. A
delayed preview is discarded after a newer edit or project switch, preventing
New Project from displaying the previous plan's thumbnail.

If the candidate itself cannot be saved, it stays available in memory for JSON
export and retry. When the library cannot be read, a fresh candidate ID avoids
assuming any stored ID is free, and existing storage error feedback remains
available. Unreadable library bytes are never overwritten. Importing a copy does
consume additional local browser storage; there is no automatic eviction.

## Validation and costs

367 unit tests pass, including 17 new cases covering pending edits, validation
before writes, duplicate IDs, damaged entries, unavailable storage, candidate
write failure, concurrent edits, superseded reads and navigation cancellation.
New browser workflows cover desktop/390 px copies, library reopening, JSON
backup/retry, storage failure, RoomPlan and new-project preservation, delayed
imports, welcome/library templates and 3D. Final CI and live browser results are
recorded on the linked PR.

All changes run locally. No Firebase Storage operations, hosted endpoints,
iPhone export schema or storage rules change. Existing asset/caching and
zero-external-request browser checks remain in place. This does not resolve the
client distribution, legacy rule cutover or billing work in issue #30.
