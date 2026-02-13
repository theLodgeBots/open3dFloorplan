# Bug Report - v0.4.6 QA Testing
> Date: 2026-02-12

## Critical Bugs

### 1. Room area doesn't respect imperial units
- **Steps**: Switch to ft/inch in Settings > Dimensions, look at room labels and status bar
- **Expected**: Area shows in sq ft (e.g. "129 ft²")
- **Actual**: Always shows m² regardless of unit setting
- **Affected**: Canvas room labels, Properties panel area, status bar total area, 3D room labels, SVG/DXF export
- **Files**: `FloorPlanCanvas.svelte:1558`, `PropertiesPanel.svelte:592`, `FloorPlanCanvas.svelte:3204`, `ThreeViewer.svelte:775`, `export.ts:58`, `cadExport.ts:49`

### 2. Properties panel input fields don't convert to imperial
- **Steps**: Select a wall in imperial mode, look at Length/Thickness/Height inputs
- **Expected**: Values shown in ft/inches
- **Actual**: Values always in cm — user edits in cm even when imperial is selected
- **Affected**: Wall thickness, wall height, door width/height, window width/height, furniture dimensions

## Major Bugs

### 3. Room drag may move shared walls unexpectedly
- **Steps**: Create two adjacent rooms sharing a wall, drag one room
- **Expected**: Only the selected room's walls move (shared wall stretches or detaches)
- **Actual**: Shared wall moves with the dragged room, deforming the adjacent room
- **Root cause**: `room.walls` includes shared wall IDs — both rooms reference the same wall

### 4. `buildWalls()` fires twice on floor change (orphaned 3D objects)
- **Steps**: Switch between 2D and 3D, modify walls, switch back
- **Expected**: Clean 3D scene rebuild
- **Actual**: Svelte store double-subscription causes `buildWalls()` to run twice, creating orphaned Three.js containers (memory leak over time)
- **File**: `ThreeViewer.svelte` — `activeFloor.subscribe` fires twice on reactive updates

### 5. Properties panel z-index conflicts with 3D overlay buttons
- **Steps**: In 3D mode, select a wall — properties panel appears
- **Expected**: Panel sits cleanly to the right, 3D buttons (edit/screenshot/walkthrough) remain accessible
- **Actual**: Panel may overlap the 3D action buttons in top-right corner (both use z-index, fixed positioning)

### 6. Extension lines setting only affects wall dimensions
- **Steps**: Toggle "Extension Lines" off in settings
- **Expected**: All extension lines disappear
- **Actual**: Only wall dimension extension lines are toggled — door/window distance dimension lines still show their own extension-style marks

### 7. "External Dimensions" and "Internal Dimensions" toggles do nothing
- **Steps**: Toggle these in Settings > Dimensions
- **Expected**: External/internal dimension lines show/hide
- **Actual**: No effect — these settings exist in the store but aren't wired to any rendering logic
- **Note**: Would need separate rendering passes for external (outside building envelope) and internal (inside room) dimensions

### 8. "Object Distance" toggle does nothing
- **Steps**: Toggle in Settings > Dimensions
- **Expected**: Distance lines from furniture to walls show/hide
- **Actual**: No effect — not wired to rendering

## Minor Bugs

### 9. Dimension line color only partially applied
- **Steps**: Switch line color to white in settings
- **Expected**: All dimension elements turn white
- **Actual**: Main dimension text changes, but dimension lines (`#6b7280`), arrowheads, and door/window distance pills still use hardcoded colors

### 10. Properties panel flickers on rapid selection changes
- **Steps**: Quickly click different walls/furniture in succession
- **Expected**: Smooth panel content swap
- **Actual**: Panel unmounts/remounts on each selection change (due to `{#if hasSelection}`) causing a brief flicker

### 11. Status bar area always in m²
- **Steps**: Check bottom status bar in imperial mode
- **Expected**: "12.0 ft²" or similar
- **Actual**: Always "12.0 m²"
- **File**: `FloorPlanCanvas.svelte:3204`

### 12. Ruler labels don't respect unit settings
- **Steps**: Switch to imperial, look at ruler markings on canvas edges
- **Expected**: Rulers show feet/inches
- **Actual**: Always show cm/m
- **File**: `FloorPlanCanvas.svelte:1675,1709`

### 13. Room preset drag offset
- **Steps**: Drag a room preset from the Rooms panel onto the canvas
- **Expected**: Room centered at drop point
- **Actual**: Room origin is at top-left — the room appears offset from where you dropped

### 14. Settings dialog doesn't default to Project tab
- **Steps**: Open settings
- **Expected**: Could argue either tab is fine as default
- **Actual**: Always opens on Dimensions tab — might be more intuitive to open on Project tab first time

### 15. 3D furniture may have wrong orientation after non-uniform scaling
- **Steps**: Place furniture, view in 3D
- **Expected**: Furniture faces correct direction matching 2D rotation
- **Actual**: Non-uniform `scaleToFit` can stretch models disproportionally if GLB model's local axes don't align with our width/depth/height convention (e.g. some Kenney models have Z as up)

### 16. Curved wall dimensions show straight-line length
- **Steps**: Create a curved wall, check dimension label
- **Expected**: Arc length shown
- **Actual**: The curved wall dimension code path (line ~603) calculates `wlen` which may be chord length not arc length depending on `wallLength()` implementation

### 17. No visual feedback during drag-and-drop from panel
- **Steps**: Drag a furniture item from the Objects panel toward the canvas
- **Expected**: Ghost preview of the item follows cursor
- **Actual**: Browser default drag image (small translucent copy of the button) — no preview on canvas until dropped

### 18. `formatLength` rounding quirk
- **Steps**: Wall of 100cm displayed in metric
- **Expected**: "1 m"
- **Actual**: "1 m" ✓ — but 150cm shows "1.50 m" (trailing zero), while "1.5 m" would be cleaner

## Working Correctly
- Wall drawing (click chain, double-click finish, close loop)
- Wall endpoint dragging
- Wall parallel movement
- Snap to grid
- Undo/redo
- Furniture placement (click-to-place)
- Furniture rotation (R key)
- Furniture resize handles
- Door/window placement on walls
- Door/window selection boxes (blue dashed)
- Multi-select (shift-click, marquee)
- Multi-select bounding box drag
- 3D view rendering (walls, doors, windows, furniture, floors)
- 3D edit mode wall selection (only clicked wall highlights)
- 3D walkthrough mode
- 3D screenshot
- Wall texture/color changes (interior/exterior)
- Floor material selection
- Room detection
- Room name/type editing
- Settings gear icon + dialog open/close
- Unit toggle UI (metric ↔ imperial buttons)
- Keyboard shortcuts (V, W, D, G, F, Space+drag, scroll zoom, Ctrl+Z/Y, R, Del, ?, Esc)
- Export PNG/SVG/JSON
- Import RoomPlan JSON
- Background image import
- Auto-save
- Project creation/switching
- Left panel hidden in 3D
- 3D starts view-only
- Furniture 3D model thumbnails in Objects panel
- Drag-and-drop furniture onto canvas
