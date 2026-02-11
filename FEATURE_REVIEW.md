# Feature Review: planner5d vs open3dFloorplan

Systematic comparison. Each feature gets: ✅ done, 🔧 needs work, ❌ missing.

## 1. Wall Drawing & Editing
- ✅ Click-to-draw walls with continuous segments
- ✅ Angle snapping (0°, 45°, 90°)
- ✅ Magnetic snap to existing endpoints
- ✅ Close loop (click near start or double-click)
- ✅ Dimension labels on walls
- 🔧 **Wall thickness visual** — planner5d shows thick filled walls with proper joins; ours are thin lines
- ✅ **Wall drag-to-resize** — grab a wall endpoint and drag to resize/reshape; connected corner endpoints move together
- ✅ **Wall segment editing** — click a wall to select, drag midpoint to move parallel
- ✅ **Curved walls** — quadratic bezier curves via draggable midpoint handle, toggle in properties panel
- ✅ **Wall splitting** — click middle of wall to split into two segments (double-click or context toolbar button)

## 2. Doors & Windows
- ✅ Can place doors and windows on walls
- ✅ **Door scale/appearance** — properly scaled 90cm default, correct proportions
- ✅ **Door swing arc in 2D** — solid thin arc, thicker door leaf line, jamb ticks
- ✅ **Window appearance** — 3 parallel lines (outer wall edges + middle glass pane) with end caps
- ✅ **Drag along wall** — click to select, drag to slide along wall
- ✅ **Size relative to wall** — door default 90cm, window 120cm
- ✅ **Door/window catalog** — 6 door types + 5 window types with unique 2D renderings, catalog grid in BuildPanel
- ✅ **Opening direction toggle** — flip swing (left/right) + flip side (inward/outward) via context toolbar

## 3. Furniture Placement
- ✅ Catalog with categories
- ✅ Click to place, drag to move, scroll/R to rotate
- ✅ **Scale in 2D** — furniture renders at correct cm dimensions relative to walls
- ✅ **Furniture icons** — canvas-drawn architectural top-down views per item type
- ✅ **Snap to walls** — furniture snaps edge-flush to nearby walls with auto-rotation alignment
- ✅ **Selection handles** — resize handles at 4 corners, rotation handle above, dashed selection border
- 🔧 **3D furniture models** — detailed procedural models (43 types) but not imported glTF; planner5d uses real 3D model assets
- ✅ **Furniture properties** — color picker (preset + custom), dimensions (W/D/H), material selector, rotation, reset to defaults

## 4. Room Detection & Display
- ✅ Auto-detects enclosed rooms
- ✅ Room labels with name + area
- ✅ Room type assignment with color coding
- ✅ Room presets (Rectangle, L, T, U shapes)
- ✅ **Room fill opacity** — subtle 6-8% opacity fills per room type
- ✅ **Room-specific floor materials in 2D** — subtle texture patterns (wood planks, tile grid, stone crosshatch) per room type

## 5. 2D Canvas / Viewport
- ✅ Pan (space+drag or middle mouse)
- ✅ Zoom (scroll wheel)
- ✅ Grid with snap
- ✅ Zoom-to-fit (F key)
- ✅ **Canvas background** — light gray with major/minor grid, subtle and clean
- ✅ **Dimension arrows** — extension lines, gapped dimension line, 45° tick marks
- ✅ **Ruler along edges** — horizontal/vertical rulers with auto-scaling ticks, mouse position indicators
- ✅ **Area dimensions** — shows room width × depth below name label in room center

## 6. 3D View
- ✅ Toggle 2D/3D
- ✅ Walls with height, interior/exterior materials
- ✅ Floor texture
- ✅ Orbit camera controls
- ✅ Room floor fills with labels
- ✅ **Door/window openings** — proper 3D frames, hinged doors, mullion windows, baseboard gaps
- ✅ **Lighting quality** — 3-point setup: warm key sun, cool fill light, rim backlight; hemisphere boost
- 🔧 **3D furniture** — procedural models (sofas, beds, tables, etc.) not imported glTF assets
- ✅ **Material/texture on walls** — wall color property reflected in 3D (interior + exterior)
- ❌ **Ceiling** — planner5d shows ceiling in 3D
- ✅ **First-person walkthrough** — PointerLock walkthrough with WASD look, arrow move, sprint, adjustable eye height/speed

## 7. UI / Layout
- ✅ Top toolbar with project name, undo/redo, 2D/3D toggle
- ✅ Left sidebar with Build/Rooms/Objects tabs
- ✅ Properties panel (right side or integrated)
- ✅ Status bar
- ✅ **Toolbar style** — SVG icons for tools, undo/redo, export menu; clean minimal aesthetic
- ✅ **Sidebar width/style** — clean layout with icon+text items
- ✅ **Tool icons** — SVG icons throughout
- ✅ **Contextual toolbar** — floating toolbar above selected elements with duplicate, delete, flip-swing buttons

## 8. Export / Save
- ✅ PNG export (2D and 3D)
- ✅ SVG export
- ✅ JSON download/import
- ✅ Auto-save to localStorage
- ✅ **PDF export** — A4 landscape with title, centered floor plan image, scale indicator, date footer (jsPDF)
- ❌ **Cloud save** (Firebase — planned for later)

## 9. Keyboard Shortcuts
- ✅ Full set (W/D/V/M/C/G/F/Tab/Escape/Ctrl+Z/Y/S/?)
- ✅ Help overlay
- Good coverage, no major gaps.

## 10. Multi-Floor
- ✅ Add/remove floors
- ✅ Copy wall layout between floors
- ✅ Floor switcher in toolbar
- Solid implementation.

---

## Priority Order (fixing what Jason noticed first)

### Phase 1: Scale & Proportions (CRITICAL — Jason's feedback)
1. ✅ Door/window sizing — default 90cm door, 120cm window, properly scaled to wall (already correct)
2. ✅ Door arc drawing — solid thin arc, thicker door leaf line, jamb ticks at gap edges
3. ✅ Furniture scale — cm dimensions render correctly in 2D (already correct)
4. ✅ Wall thickness — 15cm filled rectangles with proper corner joins (already implemented)

### Phase 2: Visual Polish
5. ✅ Top-down furniture architectural icons (sofa, bed, toilet, etc. — canvas-drawn top-down views)
6. ✅ Clean dimension lines with proper arrowheads — extension lines, gapped dimension line, 45° tick marks
7. ✅ Canvas background & grid refinement (major/minor grid, subtle background)
8. ✅ Toolbar/sidebar styling — SVG icons for tools, undo/redo, export menu; clean minimal aesthetic

### Phase 3: Interaction Improvements  
9. ✅ Drag doors/windows along walls — click to select, drag to slide along wall
10. ✅ Furniture snap-to-wall — auto-snaps edge flush to wall + aligns rotation, green highlight indicator
11. ✅ Selection handles — resize handles at 4 corners (drag to scale), rotation handle above (drag to rotate with 15° snap), dashed selection border
12. ✅ Wall endpoint drag-to-resize — grab selected wall endpoints to move them, with magnetic snap + angle snapping

### Phase 4: 3D Enhancements
13. ✅ Better door/window openings in 3D — proper frame jambs/header, hinged door panel ajar with handle, 4-pane mullion windows, baseboard gaps at doors
14. ✅ Wall materials/colors — 3D walls respect wall.color property (interior color + auto-darkened exterior)
15. ✅ Ceiling — per-room ceiling at wall height, BackSide material visible from inside, off-white
16. ✅ Improved lighting — 3-point setup: warm key sun, cool fill light, rim backlight; hemisphere boost

### Phase 5: Advanced
17. ✅ Door/window catalog — 6 door types (single, double, sliding, french, pocket, bifold) + 5 window types (standard, fixed, casement, sliding, bay) with catalog grid in BuildPanel, unique 2D renderings per type, type selector in PropertiesPanel
18. ✅ Contextual toolbar — floating toolbar appears above selected elements with duplicate, delete, and flip-swing (doors) buttons
19. ✅ Rulers on canvas edges — horizontal/vertical rulers with auto-scaling tick marks (cm/m), mouse position indicators, toggle button
20. ✅ Curved walls — quadratic bezier with drag handle, 2D/3D rendering, door/window placement on curves
