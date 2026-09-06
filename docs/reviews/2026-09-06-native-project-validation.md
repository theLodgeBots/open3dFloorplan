# Native project validation — September 6, 2026

Issue #47 closes an import/recovery gap: native JSON imports checked floor IDs and
wall arrays, but could replace the current plan with a wall whose start point was
null. The renderer then encountered malformed geometry, and autosave could persist
it. Welcome imports, saved-project reopening and version restoration did not share
nested validation.

## Changes

- A shared native-project reader checks known geometry, arrays, identifiers,
  opening references, dimensions, dates and attachment metadata before editor
  state changes. Errors identify the failing field. Failed imports preserve the
  current floor, selection, geometry, undo/redo and saved library.
- The reader clones its input and fills missing legacy arrays and defaults. It
  preserves fractional dimensions, mirrored furniture, zero wall heights/sills,
  named rooms, floor elevations, embedded images and unknown extension metadata.
  Missing dates use the Unix epoch; an absent/stale active floor uses the first
  floor. Explicitly malformed values are rejected rather than treated as absent.
- Floor-local IDs remain supported. Obsolete room/group memberships are retained
  because deleting geometry can leave historical metadata. Unknown catalog IDs
  remain available for future catalog support. Unsupported door/window/stair
  types fail explicitly. This is structural validation, not a constraint solver
  or a guarantee that a drawn plan represents a physically buildable building.
- Toolbar and welcome imports use the same reader. Welcome also accepts the
  RoomPlan JSON advertised by its existing interface, using the existing lazy
  import adapter. Invalid imports use a dismissible error instead of a browser
  alert, and the file input resets so selecting the same file can retry.
- Saved-project reopening validates before loading and verifies the library entry
  ID. No read migrates or rewrites stored bytes. Damaged projects remain available
  through the existing raw-library backup; other entries are unchanged. Library
  maps treat reserved object-property names as project IDs, and project links
  encode IDs so imported punctuation cannot cause a false save or broken link.
- Snapshot restoration validates before replacing the current plan, verifies the
  project ID and leaves the history panel open on failure. Raw version history
  can be downloaded for recovery. Unreadable history containers are not replaced
  by autosnapshot attempts. The existing ten-version bound is unchanged for
  readable history.

## Validation and cost

350 unit tests pass, including 69 new cases covering the reader, all shipped
house templates, generated iPhone handoffs, legacy defaults, rejected fields,
local-load failures and snapshot recovery. Added desktop and phone-width browser
workflows cover atomic native import rejection, unchanged saved bytes, undo/redo,
native/RoomPlan welcome imports, save/reload/3D, raw-library backup and failed snapshot
restoration, including unreadable history containers. The linked PR records final CI and live browser results.

All work remains in the browser. No schema version, hosted service, Firebase
Storage operation or iPhone export changes are introduced. This does not migrate
localStorage to IndexedDB or resolve the client-distribution and budget work in
issue #30.
