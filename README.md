# openplan3d

**Free Open Source 2D/3D Floor Plan Editor**

Design floor plans in an intuitive 2D editor, then instantly preview them in a fully navigable 3D view — all in your browser. No account required, no server dependency; your projects stay on your device.

<p align="center">
  <img src="plan1_2d.jpg" alt="2D Floor Plan View" width="48%">
  <img src="plan1_3d.jpg" alt="3D Floor Plan View" width="48%">
</p>
<p align="center">
  <img src="plan4_2d.jpg" alt="Detailed 2D Plan" width="48%">
  <img src="plan4_3d.jpg" alt="Detailed 3D View" width="48%">
</p>

---

## ✨ Features

### 🏗️ Drawing Tools
- **Walls** — Click-to-place with automatic snapping and angle constraints
- **Doors & Windows** — Multiple styles (single, double, sliding, pocket, bi-fold, french doors; casement, bay, picture windows)
- **Stairs** — Straight, L-shaped, and U-shaped with configurable dimensions
- **Rooms** — Auto-detected from walls with customizable labels and colors

### 🛋️ Furniture Library
- **140+ items** across categories: living room, bedroom, kitchen, bathroom, dining, office, outdoor, and more
- Drag-and-drop placement with rotation, resizing, and snapping
- Full **3D models** rendered in the 3D view

### 🏠 3D View
- **Real-time 3D preview** — Toggle with `Tab`
- **Walkthrough mode** — First-person navigation through your floor plan
- **Material editor** — Apply textures to walls, floors, and ceilings (wood, tile, marble, carpet, concrete, brick, and more)
- **Lighting** — Ambient and directional lighting with adjustable intensity

### 📐 Pro Tools
- **Snap to grid** with configurable grid size
- **Smart guides** and alignment helpers
- **Multi-select** with box selection and alignment tools (align left, center, right, top, middle, bottom; distribute evenly)
- **Layers** — Organize elements across multiple layers with visibility toggles
- **Annotations** — Text labels with customizable font size and color
- **Room presets** — Quickly apply standard room dimensions
- **Undo/Redo** — Full history with grouped operations
- **Version history** — Auto-saved snapshots you can restore

### 📤 Export
- **SVG** — Scalable vector graphics
- **DXF** — AutoCAD-compatible format
- **PDF** — Print-ready output with title block
- **PNG** — High-resolution raster image
- **JSON** — Full project data for backup and sharing

### 📥 Import
- **JSON** — Restore saved projects
- **Apple RoomPlan** — Import room scans from iOS devices
- **Clipboard images** — Paste reference images directly onto the canvas

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/theLodgeBots/open3dFloorplan.git
cd open3dFloorplan

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
npm run preview
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `V` | Select tool |
| `W` | Wall tool |
| `D` | Door tool |
| `T` | Text / annotation tool |
| `H` | Pan (hand) mode |
| `R` | Rotate selected furniture |
| `Tab` | Toggle 2D / 3D view |
| `Delete` / `Backspace` | Delete selected element(s) |
| `Escape` | Deselect / cancel |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+S` | Save project |

---

## 🛠️ Tech Stack

- **[SvelteKit](https://svelte.dev)** — Application framework
- **[Three.js](https://threejs.org)** — 3D rendering engine
- **[Tailwind CSS](https://tailwindcss.com)** — Styling
- **[TypeScript](https://www.typescriptlang.org)** — Type safety
- **[jsPDF](https://github.com/parallax/jsPDF)** — PDF generation
- **[dxf-writer](https://github.com/nicholaschiasson/dxf-writer)** — DXF export
- **[Firebase](https://firebase.google.com)** — Optional cloud sync

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** for your feature: `git checkout -b feature/my-feature`
3. **Make your changes** and ensure the build passes: `npm run build`
4. **Submit a pull request** with a clear description of your changes

Please keep PRs focused and include screenshots for UI changes.

---

## 📄 License

This project is open source. See the repository for license details.

---

<p align="center">
  <b>Built with ❤️ for architects, designers, and anyone who needs a floor plan.</b>
</p>
