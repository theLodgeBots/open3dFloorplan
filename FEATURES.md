# Feature Reference — Planner5D vs Our Implementation

## Planner5D Features Observed

### Top Bar
- [x] Project navigation (All Projects / Floor name)
- [x] Undo / Redo buttons
- [x] 2D / 3D toggle (pill buttons, green theme)
- [ ] Camera/Screenshot button
- [ ] Chat button
- [ ] Share button
- [ ] Menu dots (more options)
- [ ] "Switch to PRO" button
- [ ] Promo banner ("Design faster & customize...")

### Left Icon Sidebar (Vertical)
- [ ] Search icon
- [ ] Build/Home icon (opens Build panel)
- [ ] Construction icon
- [ ] Furniture icon (chair)
- [ ] People icon
- [ ] NEW items icon
- [ ] Garden/Exterior icon
- [ ] Another icon (materials?)

### Build Panel (Left Sidebar)
- [x] "Draw Walls" / "Rooms" tabs
- [ ] Smart Wizard (AI room generation)
- [ ] Forms (geometric shapes)
- [x] Construction section: Doors, Windows
- [ ] Construction: Stairs, Arches
- [x] Search box
- [ ] Thumbnail images for items (we use text/emoji)

### 2D Canvas
- [x] Grid background
- [x] Wall drawing (click to place points)
- [ ] Thick wall rendering (filled rectangles, not just lines)
- [ ] Room fill with floor texture (wood pattern)
- [ ] Room label with area (e.g., "Room (24.980 m2)")
- [x] Dimension labels on walls
- [ ] Dimension arrows outside rooms (with arrowheads)
- [ ] Selection highlight (teal/green border on selected room)
- [ ] Wall corner handles for resizing
- [x] Pan (space + drag)
- [x] Zoom (scroll wheel)
- [ ] Snap to wall endpoints (magnetic)
- [ ] Angle guides (0°, 45°, 90°)
- [ ] Right-click context menu

### 3D View
- [ ] Interior wall material (white/cream)
- [ ] Exterior wall material (dark gray/brick)
- [ ] Textured wood floor
- [ ] Proper wall thickness
- [ ] Auto-center on floor plan
- [ ] Skybox/gradient background
- [ ] Door 3D models (actual door shapes)
- [ ] Window 3D models (glass panes)
- [x] OrbitControls
- [x] Shadows
- [x] Grid helper

### Properties Panel
- [ ] Wall properties (length, thickness, color)
- [ ] Door properties (type, width, swing)
- [ ] Window properties (width, height, sill)
- [ ] Room properties (name, floor texture)

### Multi-Floor
- [ ] Floor selector ("First floor")
- [ ] Add/remove floors
- [ ] Floor counter ("1 of 5")

### Project Management
- [x] Save to localStorage
- [x] Load from localStorage
- [x] Create new project
- [x] Delete project
- [ ] Export as PNG
- [ ] Export as JSON download

### Furniture
- [ ] Categorized catalog with thumbnails
- [ ] Drag & drop placement
- [ ] Rotate & resize on canvas
- [ ] 3D representations
- [ ] Search/filter

## Phase 2 Priority (in progress)
1. Room detection & floor fill
2. Wall drawing improvements (thick walls, snap, angle guides)
3. Properties panel
4. Better 3D rendering
5. Room presets
6. Green-themed UI like planner5d

## Phase 3 (next)
1. Furniture placement (2D drag & drop)
2. Furniture 3D models (basic shapes)
3. Multi-floor support
4. Export (PNG screenshot, JSON download)
5. Left icon sidebar navigation
6. Keyboard shortcuts panel
