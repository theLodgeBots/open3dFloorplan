# openplan3d

**Free Open Source 2D/3D Floor Plan Editor**

Design floor plans in an intuitive 2D editor, then instantly preview them in a fully navigable 3D view — all in your browser. No account required, no server dependency; your projects stay on your device.

**🌐 Try it live: [app.openplan3d.com](https://app.openplan3d.com/)**

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

## 📱 Companion iOS App

Scan a room with your iPhone and get an editable floor plan in seconds. The OpenPlan3D iOS app uses LiDAR (with an AR fallback for non-LiDAR devices) to build walls, doors, and windows as you walk, calculates room areas automatically, and shows the result in 2D and 3D — then hands the plan off to the web editor with one tap (see [iOS capture handoff](#-ios-capture-handoff)).

<p align="center">
  <img src="ios_home.png" alt="iOS app — scan a room, get a floor plan" width="24%">
  <img src="ios_editor.png" alt="iOS app — edit walls, doors, and windows" width="24%">
  <img src="ios_plan.png" alt="iOS app — room areas calculated" width="24%">
  <img src="ios_3d.png" alt="iOS app — 3D view of the scanned space" width="24%">
</p>

---

## 🚀 Getting Started

The easiest way to try openplan3d is the hosted version at **[app.openplan3d.com](https://app.openplan3d.com/)** — no install needed.

To run it locally, use Node.js 24 (see `.nvmrc`) and npm:

```bash
# Clone the repository
git clone https://github.com/laanlabs/openPlan3D.git
cd openPlan3D

# Install dependencies
npm ci

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Development Checks

```bash
npm test
npm run check
npm run build
```

GitHub Actions runs these checks for pull requests and pushes to `main`.
The regression suite covers local storage failures, autosave status, room metadata
and exports, and keyboard tools. Use `npm run test:watch` while working on a fix.
Browser smoke checks remain manual; the unit suite does not simulate drawing or touch gestures.

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
3. **Make your changes** and run `npm test`, `npm run check`, and `npm run build`
4. **Submit a pull request** with a clear description of your changes

Please keep PRs focused and include screenshots for UI changes.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <b>Built with ❤️ for architects, designers, and anyone who needs a floor plan.</b>
</p>

---

## 📱 iOS capture handoff

The companion iOS app can hand a fresh [Apple RoomPlan](https://developer.apple.com/augmented-reality/roomplan/) scan directly to the web editor via Firebase Storage:

1. The iOS app uploads the RoomPlan `room.json` to Firebase Storage at `inbox/{CODE}.json` in the `openplan3d.firebasestorage.app` bucket, where `CODE` is 8 characters from `[A-Z2-9]` (I, O, 0 and 1 are excluded to avoid ambiguity).
2. The app shows a QR code / link of the form:

   ```
   https://app.openplan3d.com/editor?import=CODE
   ```

3. When the editor opens with an `import` query param, it downloads the JSON straight from Firebase Storage (no SDK needed):

   ```
   https://firebasestorage.googleapis.com/v0/b/openplan3d.firebasestorage.app/o/inbox%2F{CODE}.json?alt=media
   ```

   and imports it through the regular RoomPlan pipeline (default options: straighten + orthogonal), creating a new project. On success the `import` param is replaced with the new project's `id` so a refresh won't re-import.

Access is controlled by [`storage.rules`](storage.rules): public **read** and **create** are allowed only on `inbox/{CODE}.json` (content type `application/json`, < 10 MB); updates, deletes, and everything else in the bucket are denied.

### One-time setup (project owner)

1. **Enable Storage** for the `openplan3d` project in the [Firebase console](https://console.firebase.google.com/project/openplan3d/storage) if it isn't already.
2. **Deploy the rules:**

   ```bash
   firebase deploy --only storage
   ```

3. **Auto-delete stale captures** — set a lifecycle rule that deletes objects under the `inbox/` prefix after 1 day (prefix-scoped lifecycle uses `matchesPrefix`). Save this as `lifecycle.json`:

   ```json
   {
     "rule": [
       {
         "action": { "type": "Delete" },
         "condition": { "age": 1, "matchesPrefix": ["inbox/"] }
       }
     ]
   }
   ```

   Then apply it with either:

   ```bash
   gcloud storage buckets update gs://openplan3d.firebasestorage.app --lifecycle-file=lifecycle.json
   # or
   gsutil lifecycle set lifecycle.json gs://openplan3d.firebasestorage.app
   ```

4. **CORS** — the editor downloads captures from the browser, so the bucket must allow
   cross-origin GETs (without this the import fails with a CORS error in the console).
   Save this as `cors.json`:

   ```json
   [
     {
       "origin": [
         "https://app.openplan3d.com",
         "https://openplan3d--openplan3d.us-east4.hosted.app",
         "http://localhost:5173"
       ],
       "method": ["GET"],
       "responseHeader": ["Content-Type"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

   Then apply it (changes take a minute or two to propagate):

   ```bash
   gcloud storage buckets update gs://openplan3d.firebasestorage.app --cors-file=cors.json
   ```
