# Feature Review: planner5d vs open3dFloorplan

Systematic comparison. Each feature gets: ✅ done, 🔧 needs work, ❌ missing.

## 1. Wall Drawing & Editing
- ✅ Click-to-draw walls with continuous segments
- ✅ Angle snapping (0°, 45°, 90°)
- ✅ Magnetic snap to existing endpoints
- ✅ Close loop (click near start or double-click)
- ✅ Dimension labels on walls
- 🔧 **Wall thickness visual** — planner5d shows thick filled walls with proper joins; ours are thin lines
- 🔧 **Wall drag-to-resize** — planner5d lets you grab a wall endpoint and drag to resize/reshape
- 🔧 **Wall segment editing** — click a wall to select, drag midpoint to move parallel
- ❌ **Curved walls** — planner5d supports arcs
- ❌ **Wall splitting** — click middle of wall to split into two segments

## 2. Doors & Windows
- ✅ Can place doors and windows on walls
- 🔧 **Door scale/appearance** — doors look wrong size compared to walls (Jason's feedback)
- 🔧 **Door swing arc in 2D** — should show quarter-circle swing direction clearly
- 🔧 **Window appearance** — should show parallel lines with glass indication
- 🔧 **Drag along wall** — doors/windows should slide along the wall they're on
- 🔧 **Size relative to wall** — door default width should be ~90cm, window ~120cm
- ❌ **Door/window catalog** — planner5d has multiple door types (single, double, sliding, French, pocket)
- ❌ **Opening direction toggle** — easy flip of swing direction

## 3. Furniture Placement
- ✅ Catalog with categories
- ✅ Click to place, drag to move, scroll/R to rotate
- 🔧 **Scale in 2D** — furniture rectangles need to render at correct cm scale relative to walls
- 🔧 **Furniture icons** — using emoji, should use SVG top-down views (sofa looks like a sofa from above)
- ✅ **Snap to walls** — furniture snaps edge-flush to nearby walls with auto-rotation alignment
- 🔧 **Selection handles** — resize handles, rotation handle (circle at corner)
- ❌ **3D furniture models** — planner5d shows real 3D models; we show colored boxes
- ❌ **Furniture properties** — color/material picker per item

## 4. Room Detection & Display
- ✅ Auto-detects enclosed rooms
- ✅ Room labels with name + area
- ✅ Room type assignment with color coding
- ✅ Room presets (Rectangle, L, T, U shapes)
- 🔧 **Room fill opacity** — should be subtle, not overwhelming
- ❌ **Room-specific floor materials in 2D** — floor texture pattern shown in 2D view

## 5. 2D Canvas / Viewport
- ✅ Pan (space+drag or middle mouse)
- ✅ Zoom (scroll wheel)
- ✅ Grid with snap
- ✅ Zoom-to-fit (F key)
- 🔧 **Canvas background** — planner5d uses very light gray with subtle grid; ours may be too dark/bright
- 🔧 **Dimension arrows** — planner5d shows clean dimension lines with arrowheads outside the wall
- ❌ **Ruler along edges** — planner5d has measurement rulers on canvas borders
- ❌ **Area dimensions** — show room dimensions (width × depth) in the room center

## 6. 3D View
- ✅ Toggle 2D/3D
- ✅ Walls with height, interior/exterior materials
- ✅ Floor texture
- ✅ Orbit camera controls
- ✅ Room floor fills with labels
- 🔧 **Door/window openings** — verify doors create proper openings in 3D walls
- 🔧 **Lighting quality** — planner5d has nice ambient + directional; ours might need tuning
- ❌ **3D furniture** — only colored boxes, not models
- ❌ **Material/texture on walls** — paint colors, wallpaper, etc.
- ❌ **Ceiling** — planner5d shows ceiling in 3D
- ❌ **First-person walkthrough** — planner5d has a walk mode

## 7. UI / Layout
- ✅ Top toolbar with project name, undo/redo, 2D/3D toggle
- ✅ Left sidebar with Build/Rooms/Objects tabs
- ✅ Properties panel (right side or integrated)
- ✅ Status bar
- 🔧 **Toolbar style** — planner5d has very clean minimal icons; ours uses text buttons
- 🔧 **Sidebar width/style** — planner5d sidebar is narrower with icon+text items
- 🔧 **Tool icons** — planner5d uses clean SVG icons; we use emoji or text
- ❌ **Contextual toolbar** — planner5d shows context tools when item selected (duplicate, delete, flip)

## 8. Export / Save
- ✅ PNG export (2D and 3D)
- ✅ SVG export
- ✅ JSON download/import
- ✅ Auto-save to localStorage
- ❌ **PDF export**
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
12. Wall endpoint drag-to-resize

### Phase 4: 3D Enhancements
13. Better door/window openings in 3D
14. Wall materials/colors
15. Ceiling
16. Improved lighting

### Phase 5: Advanced
17. Door/window catalog (types)
18. Contextual toolbar
19. Rulers on canvas edges
20. Curved walls
