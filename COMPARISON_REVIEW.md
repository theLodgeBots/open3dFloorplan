# Feature Status — open3dFloorplan

## Legend
- ✅ We have it
- 🟡 Partial — we have something but needs improvement
- ❌ We don't have it
- 🚫 Skippable — premium/niche feature, low priority

---

## 1. CORE DRAWING & EDITING

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| Draw walls (click-to-click) | ✓ | ✓ | ✅ |
| Wall thickness control | ✓ | ✓ | ✅ |
| Wall height control | ✓ | ✓ | ✅ |
| Magnetic snap to endpoints | ✓ | ✓ | ✅ |
| Angle snap (45°) | ✓ | ✓ | ✅ |
| Grid snap toggle | ✓ | ✓ | ✅ |
| Close loops (auto-detect rooms) | ✓ | ✓ | ✅ |
| Curved walls | ✓ | ✓ | ✅ |
| Wall splitting | ✓ | ✓ | ✅ |
| Connected corner dragging | ✓ | ✓ | ✅ |
| Parallel wall drag | ✓ | ✓ | ✅ |
| Room presets (drag pre-made rooms) | ✓ | ✓ | ✅ |
| Multi-select (marquee drag + shift-click) | ✓ | ✓ | ✅ |
| Room shape templates (L, T, U shapes) | ✓ | Partial (presets) | 🟡 |
| Import floor plan image (trace over) | ✓ | ✓ (with scale calibration) | ✅ |
| Smart Wizard (AI room generator) | ✓ | ✗ | 🚫 |

## 2. DOORS & WINDOWS

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| Door types (single, double, sliding, french, pocket, bifold) | ✓ | ✓ | ✅ |
| Window types (standard, fixed, casement, sliding, bay) | ✓ | ✓ | ✅ |
| Drag to reposition on wall | ✓ | ✓ | ✅ |
| Distance from wall endpoints (editable) | ✓ | ✓ | ✅ |
| Placement preview on hover | ✓ | ✓ | ✅ |
| Flip swing direction | ✓ | ✓ | ✅ |
| Photo-realistic door/window catalog | ✓ (photo thumbnails) | ✗ (icon-based) | 🟡 |
| Garage doors | ✓ | ✗ | ❌ |
| Skylights | ✓ | ✗ | ❌ |

## 3. CONSTRUCTION ELEMENTS

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| Stairs (straight) | ✓ | ✓ | ✅ |
| Stairs (L, spiral, U shapes) | ✓ | ✗ | ❌ |
| Arches | ✓ | ✗ | ❌ |
| Partitions (half-walls, dividers) | ✓ | ✗ | ❌ |
| Columns/pillars | ✓ | ✗ | ❌ |
| Roofs (flat, gable, hip, mansard) | ✓ | ✗ | ❌ |
| Fireplaces | ✓ | ✗ | ❌ |
| Terraces/decks | ✓ | ✗ | ❌ |
| Fences and gates | ✓ | ✗ | 🚫 |

## 4. FURNITURE & OBJECTS

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| Furniture catalog | ✓ (1000+ items) | ✓ (~43 items, 8 categories) | 🟡 |
| Room-based browsing (living room, kitchen, etc.) | ✓ | ✓ (8 categories) | ✅ |
| Search furniture by name | ✓ | ✓ | ✅ |
| Snap furniture to wall | ✓ | ✓ | ✅ |
| Furniture rotation | ✓ | ✓ | ✅ |
| Furniture resize | ✓ | ✓ | ✅ |
| Duplicate furniture | ✓ | ✓ | ✅ |
| Per-item color/material override | ✓ | ✓ | ✅ |
| Per-item dimension override | ✓ | ✓ | ✅ |
| Decor items (rugs, plants, curtains, art, mirrors) | ✓ | ✓ (11 items) | ✅ |
| Lighting fixtures (ceiling, floor, table, wall, pendant) | ✓ | ✓ (7 items + real 3D lights) | ✅ |
| Photo-realistic thumbnails | ✓ | ✗ (architectural icons) | 🟡 |
| Drag from catalog to canvas | ✓ (drag & drop) | ✓ (click to place) | 🟡 |
| Appliance catalog (washer, dryer, AC, etc.) | ✓ | ✗ | ❌ |

## 5. OUTDOOR / LANDSCAPE

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| Trees and plants | ✓ | ✗ | ❌ |
| Paths and lawns | ✓ | ✗ | ❌ |
| Patio furniture | ✓ | ✗ | ❌ |
| Swimming pool | ✓ | ✗ | 🚫 |
| Outdoor lighting | ✓ | ✗ | ❌ |
| Garage (vehicles, tools) | ✓ | ✗ | ❌ |

## 6. MATERIALS & TEXTURES

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| Wall paint colors | ✓ (extensive) | ✓ (15 colors) | ✅ |
| Wall textures (brick, stone, wood panel) | ✓ | ✓ (6 textures: brick, stone, wood panel, concrete, subway tile) | ✅ |
| Floor materials | ✓ (extensive) | ✓ (14 materials) | ✅ |
| Wall texture in 2D (pattern overlay) | ✓ | ✓ | ✅ |
| Wall texture in 3D (procedural maps) | ✓ | ✓ | ✅ |
| Ceiling materials | ✓ | ✗ | ❌ |
| Custom texture upload | ✓ | ✗ | ❌ |
| Material preview in 3D | ✓ (realistic textures) | ✓ (procedural canvas textures) | 🟡 |
| Exterior wall materials (brick, siding) | ✓ | ✗ | ❌ |

## 7. 2D VIEW

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| Grid background | ✓ | ✓ | ✅ |
| Room labels with area | ✓ | ✓ | ✅ |
| Room dimension labels (w × d) | ✓ | ✓ | ✅ |
| Wall dimension labels | ✓ | ✓ | ✅ |
| Floor texture preview in 2D | ✓ | ✓ | ✅ |
| Rulers on edges | ✓ | ✓ | ✅ |
| Zoom to fit | ✓ | ✓ | ✅ |
| Measurement tool | ✓ | ✓ | ✅ |
| Top-down furniture icons | ✓ | ✓ (architectural canvas-drawn) | ✅ |
| Selection handles (resize/rotate) | ✓ | ✓ | ✅ |
| Context toolbar (duplicate/delete/flip) | ✓ | ✓ | ✅ |
| Marquee drag-to-select (multi-select) | ✓ | ✓ | ✅ |
| Shift-click multi-select | ✓ | ✓ | ✅ |
| Background image with scale calibration | ✓ | ✓ (two-point scale + opacity + lock) | ✅ |
| Mini-map / overview | ✓ | ✗ | ❌ |
| Layer visibility toggles | ✓ | ✓ (furniture, doors, windows, stairs, labels, dimensions) | ✅ |

## 8. 3D VIEW

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| Orbit camera | ✓ | ✓ | ✅ |
| First-person walkthrough | ✓ | ✓ (WASD look, arrows move, sprint, eye height slider) | ✅ |
| Procedural furniture models | ✓ (high-quality meshes) | ✓ (basic geometry) | 🟡 |
| Wall color in 3D | ✓ | ✓ | ✅ |
| Wall textures in 3D | ✓ | ✓ (procedural canvas textures) | ✅ |
| Floor material in 3D | ✓ | ✓ | ✅ |
| Ceiling rendering | ✓ | ✓ | ✅ |
| Door/window 3D models | ✓ | ✓ (frame, panel, handle, mullions, glass) | ✅ |
| Baseboards | ✓ | ✓ | ✅ |
| Stairs in 3D | ✓ | ✓ (stepped geometry with treads/risers) | ✅ |
| Real lighting from fixtures | ✓ | ✓ (PointLight/SpotLight on ceiling/pendant lights) | ✅ |
| Realistic lighting/shadows | ✓ (PBR, shadows) | ✓ (3-point + fixture lights, PCF shadows) | 🟡 |
| Exterior walls visible | ✓ (brick/siding) | ✓ (auto-darkened color) | 🟡 |
| Photorealistic render (raytraced) | ✓ (premium) | ✗ | 🚫 |
| Room labels in 3D | ✓ | ✓ | ✅ |
| Ambient occlusion | ✓ | ✗ | ❌ |
| Environment/skybox | ✓ | ✓ (sky gradient + ground plane) | ✅ |

## 9. MULTI-FLOOR

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| Multiple floors | ✓ | ✓ | ✅ |
| Add/remove floors | ✓ | ✓ | ✅ |
| Stairs between floors | ✓ | ✓ (straight stairs with direction) | 🟡 |
| See floor below (ghost/overlay) | ✓ | ✗ | ❌ |
| 3D multi-floor stacking | ✓ | ✗ | ❌ |

## 10. EXPORT & SHARING

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| PNG export | ✓ | ✓ | ✅ |
| SVG export | ✗ | ✓ | ✅ (we're ahead!) |
| PDF export | ✓ | ✓ | ✅ |
| DXF/DWG export | ✓ (premium) | ✓ | ✅ (we're ahead!) |
| JSON project save/load | ✗ | ✓ | ✅ |
| 3D screenshot | ✓ (camera icon) | ✓ | ✅ |
| Share link | ✓ | ✗ | ❌ |
| Embed code | ✓ | ✗ | ❌ |

## 11. PROJECT MANAGEMENT

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| Auto-save (local) | ✓ | ✓ | ✅ |
| Cloud save | ✓ | ✗ | ❌ |
| Project list / My Projects | ✓ | ✗ (single project) | ❌ |
| Project templates | ✓ | ✗ | ❌ |
| Undo/redo | ✓ | ✓ | ✅ |
| Project naming | ✓ | ✓ | ✅ |

## 12. UI/UX

| Feature | Target | open3dFloorplan | Status |
|---------|-----------|-----------------|--------|
| Keyboard shortcuts | ✓ | ✓ | ✅ |
| Tooltips / onboarding | ✓ (tutorial popups) | ✗ | ❌ |
| Search across all objects | ✓ | ✓ (furniture search) | 🟡 |
| Collapsible sidebar | ✓ | ✗ | 🟡 |
| Comments/annotations | ✓ | ✗ | ❌ |
| Right-click context menu | ✓ | ✗ (right-click = measure) | ❌ |

---

## SCORE SUMMARY

| Category | ✅ | 🟡 | ❌ | 🚫 |
|----------|---|----|---|---|
| Core Drawing & Editing | 13 | 1 | 0 | 1 |
| Doors & Windows | 6 | 1 | 2 | 0 |
| Construction Elements | 1 | 0 | 7 | 1 |
| Furniture & Objects | 10 | 3 | 1 | 0 |
| Outdoor / Landscape | 0 | 0 | 4 | 1 |
| Materials & Textures | 5 | 1 | 3 | 0 |
| 2D View | 13 | 0 | 2 | 0 |
| 3D View | 10 | 3 | 2 | 1 |
| Multi-Floor | 2 | 1 | 2 | 0 |
| Export & Sharing | 5 | 0 | 3 | 0 |
| Project Management | 3 | 0 | 3 | 0 |
| UI/UX | 1 | 2 | 3 | 0 |
| **TOTAL** | **69** | **12** | **32** | **4** |

**Feature coverage: 69/113 complete (61%), 81/113 at least partial (72%)**

---

## PRIORITY RECOMMENDATIONS

### 🔴 High Priority (Core UX gaps)
1. **Cloud save (Firebase)** — Already planned, essential for real usage
2. **Project list / My Projects** — Save/load multiple projects
3. **3D screenshot** — Camera icon to capture 3D view
4. **Floor below ghost overlay** — See lower floor layout when editing upper
5. **3D multi-floor stacking** — Visualize full building in 3D

### 🟡 Medium Priority (Polish & depth)
6. **Drag & drop from catalog** — Currently click-to-place
7. **Photo-realistic catalog thumbnails** — Big visual upgrade
8. **Larger furniture catalog** — ~43 items vs 1000+; add appliances, more variants
9. **Right-click context menu** — Standard UX pattern
10. **Environment/skybox in 3D** — Sky, ground plane outside building
11. **Onboarding tooltips** — Guide new users
12. **Stair variants** — L-shape, U-shape, spiral
13. **Columns/pillars** — Structural element
14. **Ambient occlusion** — Visual quality bump in 3D
15. **Layer visibility toggles** — Show/hide furniture, dimensions, etc.

### 🟢 Low Priority (Nice-to-have)
16. **Arches** — Decorative opening
17. **Partitions/half-walls** — Room dividers
18. **Roofs** — Exterior visualization
19. **Outdoor elements** — Trees, paths, patio
20. **Ceiling materials** — Per-room ceiling texture
21. **Mini-map** — Overview when zoomed in
22. **Share link / embed** — Collaborative feature
23. **Custom texture upload** — Power user feature
24. **Exterior wall materials** — Brick/siding on outside
25. **Collapsible sidebar** — Screen real estate
26. **Comments/annotations** — Collaboration

### 🚫 Skip (Premium/niche)
- AI Smart Wizard
- Photorealistic raytraced rendering
- Swimming pools
- Fences and gates

---

## WHAT WE DO WELL

- **Core wall drawing is solid** — snap, angle, magnetic, curves, split, connected corners, parallel drag
- **Door/window system is feature-complete** — 6 door types, 5 window types, 4-direction flip, placement preview, distance dimensions
- **Export is strong export support** — SVG, DXF/DWG without premium, plus PDF, PNG, JSON
- **Material system** — 15 wall colors + 6 wall textures + 14 floor materials, all in 2D and 3D
- **Decor & lighting** — Rugs, plants, curtains, art + 7 lighting fixtures with real 3D light sources
- **Stairs** — Straight stairs with treads/risers in both 2D and 3D
- **Image import** — Trace-over with two-point scale calibration, opacity control, lock/unlock
- **Multi-select** — Marquee drag + shift-click, bulk delete
- **First-person walkthrough** — WASD look, arrow keys move, sprint, eye height/speed sliders
- **Keyboard shortcuts** — Full set for all tools

## BIGGEST REMAINING GAPS

- **No cloud save / multi-project** — Single localStorage project
- **Furniture catalog depth** — ~43 vs 1000+ items
- **No multi-floor 3D stacking** — Can't see full building
- **No outdoor/landscape** — No trees, paths, pools
- **Construction elements** — No columns, arches, roofs, fireplaces
- **3D visual quality** — Procedural textures vs PBR realistic materials
