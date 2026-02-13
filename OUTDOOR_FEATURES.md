# Outdoor Features Catalog

> Research compiled from industry standard floor plan editors and feature analysis.
> Date: 2026-02-12

The editor offers a dedicated **Outdoor** mode in its editor (toggled via floor/ceil/indoor/outdoor tabs). The outdoor catalog contains hundreds of items across the categories below. Items are drag-and-drop with customizable size, color, and material. Both 2D symbols and 3D models are provided.

---

## 1. Outdoor Furniture

| Item | Approx Dimensions | Priority | Implementation Notes |
|------|-------------------|----------|---------------------|
| Patio dining table (round) | 120cm dia | High | Simple cylinder/disc mesh + legs |
| Patio dining table (rectangular) | 180×90cm | High | Box geometry |
| Patio chairs (various styles) | 50×50×85cm | High | Low-poly GLTF models |
| Lounge chair / sun lounger | 190×70×35cm | High | Parametric or prefab model |
| Outdoor sofa / sectional | 200×80×70cm | Medium | Modular pieces |
| Hammock | 300×120cm | Low | Cloth physics or static curved mesh |
| Swing bench | 150×60×180cm | Low | Static model with chain geometry |
| BBQ grill (charcoal) | 60×50×100cm | Medium | Prefab GLTF |
| BBQ grill (gas, large) | 150×60×120cm | Medium | Prefab GLTF |
| Fire pit (round) | 90cm dia × 40cm | Medium | Emissive material + particle effect |
| Outdoor bar / counter | 180×60×110cm | Low | Box geometry + stools |
| Picnic table | 180×150×75cm | Medium | Simple geometry |
| Umbrella / parasol | 270cm dia, 250cm tall | High | Cone geometry + pole |
| Outdoor bean bag | 80×80×60cm | Low | Soft body mesh |
| Planter box / pot (various) | 30-80cm | Medium | Cylinder/box + plant models |
| Outdoor rug | 200×300cm | Low | Flat textured plane |
| Cushions / pillows | 40×40cm | Low | Simple box meshes |

## 2. Landscaping & Plants

| Item | Approx Dimensions | Priority | Implementation Notes |
|------|-------------------|----------|---------------------|
| Deciduous tree (oak, maple, etc.) | 5-12m tall | High | Billboard or low-poly branching model |
| Evergreen tree (pine, spruce) | 6-15m tall | High | Cone-based geometry or instanced |
| Palm tree | 4-10m tall | High | Trunk cylinder + frond planes |
| Fruit tree (apple, cherry) | 3-5m tall | Medium | Similar to deciduous, smaller |
| Small ornamental tree | 2-4m tall | Medium | Low-poly mesh |
| Large bush / hedge | 100×100×150cm | High | Rounded box with leaf texture |
| Small bush / shrub | 60×60×80cm | High | Sphere-ish mesh |
| Hedge row (linear) | 100×40×150cm | High | Extruded box, repeatable |
| Flower bed (rectangular) | 200×60×20cm | Medium | Textured plane + scattered flower models |
| Flower bed (circular) | 120cm dia | Medium | Disc + flowers |
| Individual flowers (roses, tulips, etc.) | 30-60cm | Low | Instanced billboards |
| Grass / lawn (ground cover) | N/A (texture) | High | Ground plane with grass texture/shader |
| Garden bed with mulch | Various | Medium | Textured ground region |
| Topiary (shaped bushes) | 60-150cm | Low | Geometric shapes with leaf material |
| Climbing plants / ivy | Variable | Low | Texture overlay on walls/fences |
| Cactus / succulents | 20-100cm | Low | Simple geometric models |
| Vegetable garden rows | 300×100cm | Low | Textured strips |
| Rock / boulder (decorative) | 30-100cm | Medium | Irregular mesh or prefab |
| Rock garden arrangement | 200×200cm | Low | Group of rock models |
| Mulch ground cover | N/A (texture) | Medium | Material/texture swap on ground |
| Gravel ground cover | N/A (texture) | Medium | Material/texture swap on ground |

## 3. Outdoor Structures

| Item | Approx Dimensions | Priority | Implementation Notes |
|------|-------------------|----------|---------------------|
| Wooden fence (panel) | 180×180cm | High | Repeatable segment, snap-to-grid |
| Metal/iron fence | 180×120cm | High | Thin bar geometry |
| Picket fence | 180×100cm | High | Repeating picket pattern |
| Chain-link fence | 180×120cm | Medium | Semi-transparent mesh texture |
| Stone/brick wall (low) | 180×90cm | High | Textured box |
| Gate (single) | 100×180cm | High | Hinged door variant |
| Gate (double/driveway) | 300×180cm | Medium | Two-panel gate |
| Pergola | 300×300×260cm | High | Post-and-beam geometry |
| Gazebo (hexagonal/octagonal) | 350cm dia × 300cm | Medium | Prefab model with roof |
| Arbor / garden arch | 150×40×240cm | Medium | Arch geometry |
| Deck / wooden platform | Custom size | High | Planked texture on raised plane |
| Patio (concrete/stone) | Custom size | High | Textured ground region |
| Retaining wall | Variable × 60-120cm | Medium | Extruded profile |
| Shed / garden shed | 250×200×240cm | Medium | Simple box with roof |
| Greenhouse | 300×200×250cm | Low | Transparent panel structure |
| Carport | 300×500×250cm | Low | Post + flat roof |
| Trellis | 180×30×200cm | Low | Grid geometry |
| Raised garden bed | 120×60×40cm | Medium | Open-top box |
| Steps / outdoor stairs | 100×30×15cm per step | Medium | Stacked box geometry |
| Railing / balustrade | Variable × 90cm | High | Post + rail segments |
| Columns / pillars | 30×30×250cm | Medium | Cylinder or box column |
| Awning / canopy | 300×200cm | Medium | Angled plane with fabric texture |

## 4. Outdoor Lighting

| Item | Approx Dimensions | Priority | Implementation Notes |
|------|-------------------|----------|---------------------|
| Post lamp / garden lamp | 30×30×200cm | High | PointLight + lamp model |
| Wall-mounted sconce | 15×20×30cm | Medium | SpotLight + model on wall |
| String lights / fairy lights | Variable length | Medium | Line geometry + emissive points |
| Pathway light (bollard) | 15×15×50cm | Medium | Small PointLight + cylinder |
| Spotlight (ground) | 10×10×15cm | Medium | SpotLight aimed upward |
| Solar stake light | 5×5×40cm | Low | Simple cylinder + glow |
| Lantern (decorative) | 20×20×30cm | Low | Prefab mesh |
| Pool/underwater light | N/A | Low | PointLight inside pool volume |
| Flood light | 20×15×20cm | Low | SpotLight with wide angle |
| Torch / tiki torch | 10×10×150cm | Low | Cylinder + flame particle |

## 5. Driveways, Pathways & Patios

| Item | Approx Dimensions | Priority | Implementation Notes |
|------|-------------------|----------|---------------------|
| Concrete driveway | Custom shape | High | Textured ground region, draw tool |
| Asphalt driveway | Custom shape | High | Dark texture variant |
| Brick/paver pathway | Custom path | High | Tiled texture on path shape |
| Flagstone pathway | Custom path | Medium | Irregular stone texture |
| Gravel path | Custom path | Medium | Gravel material on path |
| Wooden boardwalk | Custom path | Medium | Plank texture on raised strip |
| Stepping stones | 40cm dia, spaced | Medium | Scattered disc objects |
| Concrete patio | Custom shape | High | Large textured ground area |
| Stone patio (bluestone, slate) | Custom shape | High | Material variant |
| Brick patio | Custom shape | Medium | Brick pattern texture |
| Tile patio | Custom shape | Medium | Tile pattern texture |
| Driveway border / edging | Variable | Low | Thin raised strip |
| Curb | Variable × 15cm | Low | Extruded profile |

## 6. Water Features

| Item | Approx Dimensions | Priority | Implementation Notes |
|------|-------------------|----------|---------------------|
| Swimming pool (rectangular) | 400×800×150cm | High | Recessed box with water shader |
| Swimming pool (kidney/freeform) | Custom shape | Medium | Custom shape + water material |
| Hot tub / jacuzzi | 200×200×80cm | Medium | Round recessed vessel |
| Fountain (tiered) | 100×100×150cm | Medium | Prefab model + water particles |
| Fountain (wall-mounted) | 60×20×80cm | Low | Model mounted on wall |
| Garden pond | Custom shape | Medium | Irregular recessed area + water |
| Koi pond | 200×150×60cm | Low | Variant of garden pond |
| Waterfall (decorative) | Variable | Low | Animated water texture on rock |
| Birdbath | 40×40×80cm | Low | Simple column + basin |
| Pool deck / coping | Variable | Medium | Textured border around pool |
| Pool ladder | 50×50×120cm | Low | Metal bar geometry |
| Diving board | 50×300×100cm | Low | Plank + spring model |
| Pool lounge area | Variable | Medium | Composition of loungers + pool |

## 7. Sports & Recreation

| Item | Approx Dimensions | Priority | Implementation Notes |
|------|-------------------|----------|---------------------|
| Basketball hoop (driveway) | 120×120×305cm | Low | Pole + backboard + hoop |
| Trampoline | 300cm dia × 90cm | Low | Circle frame + mesh surface |
| Playground swing set | 300×200×250cm | Low | A-frame + chain + seat |
| Playground slide | 200×60×150cm | Low | Curved surface model |
| Sandbox | 200×200×30cm | Low | Open box with sand texture |
| Tennis/sport court | 1100×2400cm | Low | Textured ground plane + net |
| Outdoor gym equipment | Various | Low | Individual prefab models |
| Ping pong table | 152×274×76cm | Low | Table + net model |
| Cornhole boards | 60×120cm each | Low | Angled plane models |
| Dog house | 80×100×80cm | Low | Simple box + roof |
| Playhouse | 150×150×180cm | Low | Miniature house model |

## 8. Vehicles & Accessories

| Item | Approx Dimensions | Priority | Implementation Notes |
|------|-------------------|----------|---------------------|
| Sedan car | 450×180×145cm | Low | Low-poly car model |
| SUV | 480×190×175cm | Low | Low-poly model |
| Pickup truck | 530×200×180cm | Low | Low-poly model |
| Bicycle | 180×60×100cm | Low | Simple frame model |
| Motorcycle | 210×80×110cm | Low | Prefab model |
| Golf cart | 240×120×180cm | Low | Simple model |
| Trash/recycling bins | 60×50×100cm | Medium | Box with lid |
| Mailbox | 20×40×120cm | Low | Post + box model |
| Garden hose reel | 40×40×40cm | Low | Simple model |
| Wheelbarrow | 70×60×60cm | Low | Prefab model |
| Lawn mower | 50×45×100cm | Low | Prefab model |

## 9. Terrain & Elevation Tools

| Feature | Priority | Implementation Notes |
|---------|----------|---------------------|
| Flat terrain plane | High | Default ground plane, configurable material (grass, dirt, etc.) |
| Terrain elevation/sculpting | Medium | Standard apps support basic elevation. Implement via heightmap or vertex displacement on subdivided plane |
| Slope/grade tool | Medium | Linear gradient on terrain mesh vertices |
| Hill creation | Medium | Gaussian bump on terrain heightmap |
| Multi-level yards (terracing) | Medium | Stepped terrain with retaining walls |
| Terrain material painting | High | Splatmap shader: paint grass, dirt, gravel, stone on terrain |
| Water plane (lake/pond level) | Medium | Flat reflective plane at specified Y |
| Ground texture tiling | High | Repeating PBR textures on ground |
| Contour lines (2D view) | Low | Generated from heightmap for 2D display |

## 10. Property Boundaries & Lot Lines

| Feature | Priority | Implementation Notes |
|---------|----------|---------------------|
| Property boundary lines | High | Dashed line overlay on ground, configurable shape |
| Lot dimensions / measurement | High | Length labels on boundary segments |
| Setback lines | Medium | Offset inner boundary lines (building setbacks) |
| Easement markings | Low | Hatched overlay zones |
| North arrow / compass | Medium | UI overlay indicating orientation |
| Scale indicator | High | Always-visible scale bar in 2D view |
| Lot area calculation | Medium | Auto-calculate from boundary polygon |
| Address / lot label | Low | Text overlay on plan |
| Survey point markers | Low | Pin icons at boundary corners |
| Zoning overlay | Low | Color-coded zones (future feature) |

---

## Implementation Strategy for Three.js/SvelteKit

### Asset Pipeline
- **3D Models**: Use GLTF/GLB format. Source from free libraries (Sketchfab CC0, KenShape, poly.pizza) or create parametric geometry
- **Textures**: PBR texture sets (albedo, normal, roughness) for materials. Sources: ambientCG, Poly Haven
- **LOD System**: Use 3 LOD levels for trees and complex models (full detail → billboard at distance)

### Rendering Approach
- **Ground/Terrain**: Subdivided plane with vertex displacement + splatmap shader for multi-material painting
- **Water**: Reflective/refractive plane shader (Three.js Water2 or custom)
- **Plants/Trees**: Instanced meshes for performance; billboard sprites at distance
- **Lighting**: Directional sun + ambient. Outdoor lights as PointLight/SpotLight objects
- **Shadows**: Cascaded shadow maps for outdoor scenes

### Interaction Model
- **Drag-and-drop** from catalog sidebar (matching standard floor plan editor UX)
- **Snap-to-grid** for fences, walls, pathways
- **Path drawing tool** for driveways, walkways, property boundaries
- **Region painting** for ground textures (grass, gravel, concrete)
- **Resize handles** for pools, patios, custom shapes

### Priority Phasing

**Phase 1 (MVP - High Priority)**
- Flat terrain with grass texture
- Property boundaries + lot lines + measurements
- Basic fences and walls
- Concrete/paver patios and driveways
- Trees (3-4 types), bushes, hedges
- Patio furniture (table, chairs, umbrella)
- Post lamps
- Rectangular swimming pool
- Deck platform

**Phase 2 (Medium Priority)**
- Terrain elevation tools
- Pergola, gazebo, arbor
- Fire pit, BBQ grill
- More plant variety (flowers, garden beds)
- Pathway drawing tool with material options
- Hot tub, fountain, garden pond
- String lights, pathway lights
- Retaining walls, steps
- Trash bins, planters

**Phase 3 (Nice-to-Have - Low Priority)**
- Vehicles (cars, bikes)
- Sports equipment (basketball hoop, trampoline)
- Playground equipment
- Greenhouse, shed models
- Decorative items (lanterns, birdbath, mailbox)
- Advanced water features (waterfall, koi pond)
- Hammock, swing bench
- Climbing plants, topiary
- Zoning overlays, easement markings

---

## Key Features to Implement

1. **Indoor/Outdoor toggle** - Separate modes for interior vs exterior editing
2. **Extensive drag-and-drop catalog** - Organized by category with search
3. **Customizable objects** - Size, color, material per item
4. **2D ↔ 3D view switching** - Seamless transition
5. **Photo-realistic rendering** - High-quality output for sharing
6. **Property boundary drawing** - Define lot shape and dimensions
7. **Ground material regions** - Paint different surface types
8. **Templates** - Pre-made landscape layouts to start from
9. **360° walkthrough** - VR-style exploration of designs
10. **AI-powered suggestions** - Auto-layout and design recommendations
