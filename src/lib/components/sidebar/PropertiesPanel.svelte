<script lang="ts">
  import { activeFloor, selectedElementId, selectedRoomId, updateWall, updateDoor, updateWindow, updateRoom, updateFurniture, detectedRoomsStore, updateStair, updateColumn, updateBackgroundImage, setBackgroundImage, calibrationMode, calibrationPoints, updateTextAnnotation, toggleFurnitureLock, updateEntourageItem, removeElement, elevationWallId } from '$lib/stores/project';
  import { getEntourageDef } from '$lib/utils/entourageCatalog';
  import { floorMaterials, wallColors } from '$lib/utils/materials';
  import { getCatalogItem } from '$lib/utils/furnitureCatalog';
  import { projectSettings, formatLength, formatArea } from '$lib/stores/settings';
  import { base } from '$app/paths';
  import type { Floor, Wall, Door, Window as Win, Room, FurnitureItem, Stair, Column, RoomCategory, TextAnnotation } from '$lib/models/types';

  let floor = $state<Floor | null>(null);
  let selId: string | null = $state(null);
  let selRoomId: string | null = $state(null);
  let detectedRooms: Room[] = $state([]);

  activeFloor.subscribe((f) => { floor = f; });
  selectedElementId.subscribe((id) => { selId = id; });
  selectedRoomId.subscribe((id) => { selRoomId = id; });
  detectedRoomsStore.subscribe((rooms) => { detectedRooms = rooms; });

  let settings = $state($projectSettings);
  projectSettings.subscribe((s) => { settings = s; });

  function displayValue(cm: number): number {
    return settings.units === 'imperial' ? Math.round(cm / 2.54 * 10) / 10 : cm;
  }
  function inputToCm(value: number): number {
    return settings.units === 'imperial' ? value * 2.54 : value;
  }
  function unitLabel(): string {
    return settings.units === 'imperial' ? 'in' : 'cm';
  }

  let { is3D = false }: { is3D?: boolean } = $props();
  let wallSideTab = $state<'interior' | 'exterior'>('interior');
  let selectedWall = $derived(floor?.walls?.find(w => w.id === selId) ?? null);
  let selectedDoor = $derived(floor?.doors?.find(d => d.id === selId) ?? null);
  let selectedWindow = $derived(floor?.windows?.find(w => w.id === selId) ?? null);
  let selectedFurniture = $derived(floor?.furniture?.find(f => f.id === selId) ?? null);
  let selectedStair = $derived(floor?.stairs?.find(s => s.id === selId) ?? null);
  let selectedColumn = $derived(floor?.columns?.find(c => c.id === selId) ?? null);
  let selectedTextAnnotation = $derived(floor?.textAnnotations?.find(t => t.id === selId) ?? null);
  let selectedEntourage = $derived(floor?.entourage?.find(en => en.id === selId) ?? null);
  let hasBgImage = $derived(!!floor?.backgroundImage);
  let selectedRoom = $derived(floor?.rooms?.find(r => r.id === selRoomId) ?? detectedRooms.find(r => r.id === selRoomId) ?? null);

  // Helper to get the parent wall for selected door/window
  let selectedDoorWall = $derived((selectedDoor && floor?.walls?.find(w => w.id === selectedDoor.wallId)) ?? null);
  let selectedWindowWall = $derived((selectedWindow && floor?.walls?.find(w => w.id === selectedWindow.wallId)) ?? null);

  // Helper function to calculate wall length
  function calcWallLength(wall: Wall): number {
    if (wall.curvePoint) {
      let len = 0; const N = 20;
      let px = wall.start.x, py = wall.start.y;
      for (let i = 1; i <= N; i++) {
        const t = i / N, mt = 1 - t;
        const nx = mt*mt*wall.start.x + 2*mt*t*wall.curvePoint.x + t*t*wall.end.x;
        const ny = mt*mt*wall.start.y + 2*mt*t*wall.curvePoint.y + t*t*wall.end.y;
        len += Math.hypot(nx - px, ny - py); px = nx; py = ny;
      }
      return len;
    }
    return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
  }

  let wallLength = $derived(selectedWall ? Math.round(calcWallLength(selectedWall)) : 0);

  // Calculate door distances
  let doorDistFromA = $derived(selectedDoor && selectedDoorWall ? Math.round(calcWallLength(selectedDoorWall) * selectedDoor.position) : 0);
  let doorDistFromB = $derived(selectedDoor && selectedDoorWall ? Math.round(calcWallLength(selectedDoorWall) * (1 - selectedDoor.position)) : 0);

  // Calculate window distances  
  let windowDistFromA = $derived(selectedWindow && selectedWindowWall ? Math.round(calcWallLength(selectedWindowWall) * selectedWindow.position) : 0);
  let windowDistFromB = $derived(selectedWindow && selectedWindowWall ? Math.round(calcWallLength(selectedWindowWall) * (1 - selectedWindow.position)) : 0);

  function onWallLength(e: Event) {
    if (!selectedWall) return;
    const target = e.target as HTMLInputElement;
    const newLen = inputToCm(Number(target.value));
    if (!isFinite(newLen) || newLen <= 0) return;
    const currentLen = calcWallLength(selectedWall);
    if (currentLen < 0.01) return;
    const scale = newLen / currentLen;
    const sx = selectedWall.start.x;
    const sy = selectedWall.start.y;
    const updates: Partial<Wall> = {
      end: {
        x: sx + (selectedWall.end.x - sx) * scale,
        y: sy + (selectedWall.end.y - sy) * scale,
      },
    };
    if (selectedWall.curvePoint) {
      updates.curvePoint = {
        x: sx + (selectedWall.curvePoint.x - sx) * scale,
        y: sy + (selectedWall.curvePoint.y - sy) * scale,
      };
    }
    updateWall(selectedWall.id, updates);
  }
  function onWallThickness(e: Event) {
    if (!selectedWall) return;
    updateWall(selectedWall.id, { thickness: inputToCm(Number((e.target as HTMLInputElement).value)) });
  }
  function onWallHeight(e: Event) {
    if (!selectedWall) return;
    updateWall(selectedWall.id, { height: inputToCm(Number((e.target as HTMLInputElement).value)) });
  }
  function onWallColor(e: Event) {
    if (!selectedWall) return;
    updateWall(selectedWall.id, { color: (e.target as HTMLInputElement).value });
  }
  function onDoorWidth(e: Event) {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { width: Math.max(1, inputToCm(Number((e.target as HTMLInputElement).value)) || 1) });
  }
  function onDoorHeight(e: Event) {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { height: inputToCm(Number((e.target as HTMLInputElement).value)) });
  }
  function onDoorType(e: Event) {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { type: (e.target as HTMLSelectElement).value as Door['type'] });
  }
  function onDoorSwing(e: Event) {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { swingDirection: (e.target as HTMLSelectElement).value as 'left' | 'right' });
  }
  function flipDoorHorizontal() {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { swingDirection: selectedDoor.swingDirection === 'left' ? 'right' : 'left' });
  }
  function flipDoorVertical() {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { flipSide: !(selectedDoor.flipSide ?? false) });
  }
  function onWindowType(e: Event) {
    if (!selectedWindow) return;
    updateWindow(selectedWindow.id, { type: (e.target as HTMLSelectElement).value as Win['type'] });
  }
  function onWindowWidth(e: Event) {
    if (!selectedWindow) return;
    updateWindow(selectedWindow.id, { width: Math.max(1, inputToCm(Number((e.target as HTMLInputElement).value)) || 1) });
  }
  function onWindowHeight(e: Event) {
    if (!selectedWindow) return;
    updateWindow(selectedWindow.id, { height: inputToCm(Number((e.target as HTMLInputElement).value)) });
  }
  function onWindowSill(e: Event) {
    if (!selectedWindow) return;
    updateWindow(selectedWindow.id, { sillHeight: inputToCm(Number((e.target as HTMLInputElement).value)) });
  }

  // Furniture handlers
  function onFurnitureColor(color: string) {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { color });
  }
  function onFurnitureWidth(e: Event) {
    if (!selectedFurniture) return;
    const v = Math.max(1, inputToCm(Number((e.target as HTMLInputElement).value)) || 1);
    updateFurniture(selectedFurniture.id, { width: v });
  }
  function onFurnitureDepth(e: Event) {
    if (!selectedFurniture) return;
    const v = Math.max(1, inputToCm(Number((e.target as HTMLInputElement).value)) || 1);
    updateFurniture(selectedFurniture.id, { depth: v });
  }
  function onFurnitureHeight(e: Event) {
    if (!selectedFurniture) return;
    const v = Math.max(1, inputToCm(Number((e.target as HTMLInputElement).value)) || 1);
    updateFurniture(selectedFurniture.id, { height: v });
  }
  function onFurnitureMaterial(e: Event) {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { material: (e.target as HTMLSelectElement).value });
  }
  function onFurnitureRotation(e: Event) {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { rotation: Number((e.target as HTMLInputElement).value) });
  }
  function resetFurnitureDefaults() {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { color: undefined, width: undefined, depth: undefined, height: undefined, material: undefined });
  }

  // Door distance handlers
  function onDoorDistFromA(e: Event) {
    if (!selectedDoor || !selectedDoorWall) return;
    const newDistFromA = inputToCm(Number((e.target as HTMLInputElement).value));
    const wallLen = calcWallLength(selectedDoorWall);
    const newPosition = Math.max(0.05, Math.min(0.95, newDistFromA / wallLen));
    updateDoor(selectedDoor.id, { position: newPosition });
  }
  
  function onDoorDistFromB(e: Event) {
    if (!selectedDoor || !selectedDoorWall) return;
    const newDistFromB = inputToCm(Number((e.target as HTMLInputElement).value));
    const wallLen = calcWallLength(selectedDoorWall);
    const newPosition = Math.max(0.05, Math.min(0.95, 1 - (newDistFromB / wallLen)));
    updateDoor(selectedDoor.id, { position: newPosition });
  }

  // Window distance handlers
  function onWindowDistFromA(e: Event) {
    if (!selectedWindow || !selectedWindowWall) return;
    const newDistFromA = inputToCm(Number((e.target as HTMLInputElement).value));
    const wallLen = calcWallLength(selectedWindowWall);
    const newPosition = Math.max(0.05, Math.min(0.95, newDistFromA / wallLen));
    updateWindow(selectedWindow.id, { position: newPosition });
  }
  
  function onWindowDistFromB(e: Event) {
    if (!selectedWindow || !selectedWindowWall) return;
    const newDistFromB = inputToCm(Number((e.target as HTMLInputElement).value));
    const wallLen = calcWallLength(selectedWindowWall);
    const newPosition = Math.max(0.05, Math.min(0.95, 1 - (newDistFromB / wallLen)));
    updateWindow(selectedWindow.id, { position: newPosition });
  }
  // Preset colors for rooms and columns
  const roomColorPresets = [
    { name: 'White', color: '#ffffff' },
    { name: 'Cream', color: '#fffdd0' },
    { name: 'Beige', color: '#f5f5dc' },
    { name: 'Light Gray', color: '#d1d5db' },
    { name: 'Warm Gray', color: '#b8a082' },
    { name: 'Sage Green', color: '#d4e2d4' },
    { name: 'Light Blue', color: '#dbeafe' },
    { name: 'Blush Pink', color: '#f4c2c2' },
    { name: 'Lavender', color: '#e6e6fa' },
    { name: 'Butter Yellow', color: '#fff8dc' },
  ];

  const columnColorPresets = [
    { name: 'White', color: '#ffffff' },
    { name: 'Light Gray', color: '#d1d5db' },
    { name: 'Concrete', color: '#999999' },
    { name: 'Charcoal', color: '#374151' },
    { name: 'Black', color: '#000000' },
    { name: 'Cream', color: '#fffdd0' },
    { name: 'Wood', color: '#8B6914' },
    { name: 'Bronze', color: '#cd7f32' },
    { name: 'Silver', color: '#c0c0c0' },
    { name: 'Navy', color: '#1e3a8a' },
  ];

  function updateDetectedRoom(id: string, updates: Partial<{ name: string; floorTexture: string; color: string }>) {
    detectedRoomsStore.update(rooms => rooms.map(r => r.id === id ? { ...r, ...updates } : r));
  }

  function onRoomName(e: Event) {
    if (!selectedRoom) return;
    const name = (e.target as HTMLInputElement).value;
    updateRoom(selectedRoom.id, { name });
    updateDetectedRoom(selectedRoom.id, { name });
  }
  function onRoomFloor(texture: string) {
    if (!selectedRoom) return;
    updateRoom(selectedRoom.id, { floorTexture: texture });
    updateDetectedRoom(selectedRoom.id, { floorTexture: texture });
  }
  function onRoomColor(color: string) {
    if (!selectedRoom) return;
    updateRoom(selectedRoom.id, { color });
    updateDetectedRoom(selectedRoom.id, { color });
  }

  const roomTypes = [
    { id: 'living', label: 'Living Room', icon: '🛋️' },
    { id: 'bedroom', label: 'Bedroom', icon: '🛏️' },
    { id: 'kitchen', label: 'Kitchen', icon: '🍳' },
    { id: 'bathroom', label: 'Bathroom', icon: '🚿' },
    { id: 'dining', label: 'Dining Room', icon: '🍽️' },
    { id: 'office', label: 'Office', icon: '💻' },
    { id: 'hallway', label: 'Hallway', icon: '🚶' },
    { id: 'closet', label: 'Closet', icon: '👔' },
    { id: 'laundry', label: 'Laundry', icon: '🧺' },
    { id: 'garage', label: 'Garage', icon: '🚗' },
    { id: 'custom', label: 'Custom', icon: '✏️' },
  ];

  function onRoomType(e: Event) {
    if (!selectedRoom) return;
    const typeId = (e.target as HTMLSelectElement).value;
    const rt = roomTypes.find(t => t.id === typeId);
    if (rt && rt.id !== 'custom') {
      updateRoom(selectedRoom.id, { name: rt.label });
      updateDetectedRoom(selectedRoom.id, { name: rt.label });
    }
  }

  let selectedRoomType = $derived(() => {
    if (!selectedRoom) return 'custom';
    const match = roomTypes.find(t => t.label === selectedRoom!.name);
    return match ? match.id : 'custom';
  });

  const floorTexPaths: Record<string, string> = {
    'light-oak': `${base}/textures/floor-light-oak.jpg`, 'walnut': `${base}/textures/floor-walnut.jpg`,
    'bamboo': `${base}/textures/floor-bamboo.jpg`, 'laminate': `${base}/textures/floor-laminate.jpg`,
    'ceramic-white': `${base}/textures/floor-tile-white.jpg`, 'ceramic-gray': `${base}/textures/floor-tile-gray.jpg`,
    'porcelain': `${base}/textures/floor-porcelain.jpg`,
    'marble-white': `${base}/textures/floor-marble-white.jpg`, 'marble-dark': `${base}/textures/floor-marble-dark.jpg`,
    'carpet-beige': `${base}/textures/floor-carpet-beige.jpg`, 'carpet-gray': `${base}/textures/floor-carpet-gray.jpg`,
    'concrete': `${base}/textures/floor-concrete.jpg`, 'slate': `${base}/textures/floor-slate.jpg`,
    'vinyl': `${base}/textures/floor-vinyl.jpg`,
  };
  const wallTexPaths: Record<string, string> = {
    'red-brick': `${base}/textures/brick.jpg`, 'exposed-brick': `${base}/textures/exposed-brick.jpg`,
    'stone': `${base}/textures/stone.jpg`, 'wood-panel': `${base}/textures/wood-panel.jpg`,
    'concrete-block': `${base}/textures/concrete.jpg`, 'subway-tile': `${base}/textures/subway-tile.jpg`,
  };
  const textureGroups = [
    { label: '🎨 Plain', ids: ['none'] },
    { label: '🪵 Wood', ids: ['light-oak', 'walnut', 'bamboo', 'laminate'] },
    { label: '🔲 Tile', ids: ['ceramic-white', 'ceramic-gray', 'porcelain', 'vinyl'] },
    { label: '🪨 Stone', ids: ['marble-white', 'marble-dark', 'concrete', 'slate'] },
    { label: '🧶 Carpet', ids: ['carpet-beige', 'carpet-gray'] },
  ];

  let hasSelection = $derived(!!selectedWall || !!selectedDoor || !!selectedWindow || !!selectedFurniture || !!selectedRoom || !!selectedStair || !!selectedColumn || !!selectedTextAnnotation || !!selectedEntourage || (!is3D && hasBgImage));
</script>

<!-- Right sidebar on md+; slides up as a bottom sheet on phones -->
<div class="{is3D ? 'w-80' : 'w-64'} shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto p-3 fixed right-0 top-12 bottom-9 z-40 shadow-lg max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:w-full max-md:max-h-[45vh] max-md:border-l-0 max-md:border-t max-md:rounded-t-xl max-md:shadow-2xl" class:hidden={!hasSelection}>
  {#if selectedWall}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-gray-200 rounded flex items-center justify-center text-xs">▭</span>
      Wall Properties
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">Length ({unitLabel()})</span>
        <input type="number" value={displayValue(wallLength)} onchange={onWallLength} min="1" class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Thickness ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedWall.thickness)} onchange={onWallThickness} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Height ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedWall.height)} onchange={onWallHeight} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <button
        class="w-full py-1.5 text-sm rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
        onclick={() => { if (selectedWall) elevationWallId.set(selectedWall.id); }}
        title="View this wall face-on and edit its doors and windows"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="1"/><line x1="3" y1="18" x2="21" y2="18"/><rect x="7" y="9" width="4" height="4"/><rect x="14" y="10" width="3" height="8"/></svg>
        Elevation
      </button>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500">Curved</span>
        <button
          class="px-2 py-0.5 text-xs rounded {selectedWall.curvePoint ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-100 text-gray-500 border border-gray-200'}"
          onclick={() => {
            if (selectedWall) {
              if (selectedWall.curvePoint) {
                updateWall(selectedWall.id, { curvePoint: undefined });
              } else {
                // Set curve point to offset midpoint
                const mx = (selectedWall.start.x + selectedWall.end.x) / 2;
                const my = (selectedWall.start.y + selectedWall.end.y) / 2;
                const dx = selectedWall.end.x - selectedWall.start.x;
                const dy = selectedWall.end.y - selectedWall.start.y;
                const len = Math.hypot(dx, dy) || 1;
                updateWall(selectedWall.id, { curvePoint: { x: mx + (-dy / len) * 60, y: my + (dx / len) * 60 } });
              }
            }
          }}
        >
          {selectedWall.curvePoint ? '◆ On' : '◇ Off'}
        </button>
      </div>
      <!-- Wall Material Tabs: Interior / Exterior -->
      <div>
        <div class="flex border-b border-gray-200 mb-3">
          <button
            class="flex-1 py-1.5 text-xs font-medium border-b-2 transition-colors {wallSideTab === 'interior' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}"
            onclick={() => wallSideTab = 'interior'}
          >Interior</button>
          <button
            class="flex-1 py-1.5 text-xs font-medium border-b-2 transition-colors {wallSideTab === 'exterior' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}"
            onclick={() => wallSideTab = 'exterior'}
          >Exterior</button>
        </div>
        {#if wallSideTab === 'interior'}
          {@const sideColor = selectedWall.interiorColor || selectedWall.color}
          {@const sideTex = selectedWall.interiorTexture === 'none' ? undefined : (selectedWall.interiorTexture || selectedWall.texture)}
          <div class="space-y-2">
            <span class="text-xs text-gray-500">Color</span>
            <div class="grid grid-cols-6 gap-1.5">
              {#each wallColors as wc}
                <button
                  class="w-7 h-7 rounded-md border-2 hover:border-gray-300 transition-colors {sideColor === wc.color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
                  style="background-color: {wc.color}"
                  title={wc.name}
                  onclick={() => { if (selectedWall) updateWall(selectedWall.id, { interiorColor: wc.color }); }}
                ></button>
              {/each}
            </div>
            <label class="flex items-center gap-2">
              <span class="text-xs text-gray-500">Custom:</span>
              <input type="color" value={sideColor} oninput={(e) => { if (selectedWall) updateWall(selectedWall.id, { interiorColor: (e.target as HTMLInputElement).value }); }} class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
            </label>
            <span class="text-xs text-gray-500">Texture</span>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                class="p-1.5 rounded-md border-2 text-[10px] text-center h-14 {!sideTex ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}"
                onclick={() => { if (selectedWall) updateWall(selectedWall.id, { interiorTexture: 'none' }); }}
              >None</button>
              {#each wallColors.filter(wc => wc.texture) as wc}
                {@const texPath = wallTexPaths[wc.id] ?? ''}
                <button
                  class="rounded-md border-2 text-[10px] text-center h-14 flex flex-col items-center justify-end overflow-hidden relative {sideTex === wc.id ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}"
                  style={texPath ? `background-image: url(${texPath}); background-size: cover; background-position: center;` : `background-color: ${wc.color}20`}
                  onclick={() => { if (selectedWall) updateWall(selectedWall.id, { interiorTexture: wc.id, interiorColor: wc.color }); }}
                ><span class="bg-white/80 backdrop-blur-sm rounded px-1 py-0.5 mb-0.5 text-gray-700">{wc.name}</span></button>
              {/each}
            </div>
          </div>
        {:else}
          {@const sideColor = selectedWall.exteriorColor || selectedWall.color}
          {@const sideTex = selectedWall.exteriorTexture === 'none' ? undefined : (selectedWall.exteriorTexture || selectedWall.texture)}
          <div class="space-y-2">
            <span class="text-xs text-gray-500">Color</span>
            <div class="grid grid-cols-6 gap-1.5">
              {#each wallColors as wc}
                <button
                  class="w-7 h-7 rounded-md border-2 hover:border-gray-300 transition-colors {sideColor === wc.color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
                  style="background-color: {wc.color}"
                  title={wc.name}
                  onclick={() => { if (selectedWall) updateWall(selectedWall.id, { exteriorColor: wc.color }); }}
                ></button>
              {/each}
            </div>
            <label class="flex items-center gap-2">
              <span class="text-xs text-gray-500">Custom:</span>
              <input type="color" value={sideColor} oninput={(e) => { if (selectedWall) updateWall(selectedWall.id, { exteriorColor: (e.target as HTMLInputElement).value }); }} class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
            </label>
            <span class="text-xs text-gray-500">Texture</span>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                class="p-1.5 rounded-md border-2 text-[10px] text-center h-14 {!sideTex ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}"
                onclick={() => { if (selectedWall) updateWall(selectedWall.id, { exteriorTexture: 'none' }); }}
              >None</button>
              {#each wallColors.filter(wc => wc.texture) as wc}
                {@const texPath = wallTexPaths[wc.id] ?? ''}
                <button
                  class="rounded-md border-2 text-[10px] text-center h-14 flex flex-col items-center justify-end overflow-hidden relative {sideTex === wc.id ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}"
                  style={texPath ? `background-image: url(${texPath}); background-size: cover; background-position: center;` : `background-color: ${wc.color}20`}
                  onclick={() => { if (selectedWall) updateWall(selectedWall.id, { exteriorTexture: wc.id, exteriorColor: wc.color }); }}
                ><span class="bg-white/80 backdrop-blur-sm rounded px-1 py-0.5 mb-0.5 text-gray-700">{wc.name}</span></button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

  {:else if selectedDoor}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-amber-100 rounded flex items-center justify-center text-xs">🚪</span>
      Door Properties
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">Width ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedDoor.width)} onchange={onDoorWidth} min="1" class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Distance from A ({unitLabel()})</span>
        <input type="number" value={displayValue(doorDistFromA)} onchange={onDoorDistFromA} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Distance from B ({unitLabel()})</span>
        <input type="number" value={displayValue(doorDistFromB)} onchange={onDoorDistFromB} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Height ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedDoor.height ?? 210)} onchange={onDoorHeight} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Type</span>
        <select value={selectedDoor.type} onchange={onDoorType} class="w-full px-2 py-1 border border-gray-200 rounded text-sm">
          <option value="single">Single</option>
          <option value="double">Double</option>
          <option value="sliding">Sliding</option>
          <option value="french">French</option>
          <option value="pocket">Pocket</option>
          <option value="bifold">Bifold</option>
          <option value="opening">Doorway (no door)</option>
          <option value="garage">Garage</option>
        </select>
      </label>
      {#if selectedDoor.type !== 'opening' && selectedDoor.type !== 'garage'}
      <label class="block">
        <span class="text-xs text-gray-500">Hinge Side</span>
        <div class="flex gap-2">
          <button onclick={() => { if (selectedDoor) updateDoor(selectedDoor.id, { swingDirection: 'left' }); }} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedDoor?.swingDirection === 'left' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">Left</button>
          <button onclick={() => { if (selectedDoor) updateDoor(selectedDoor.id, { swingDirection: 'right' }); }} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedDoor?.swingDirection === 'right' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">Right</button>
        </div>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Opens</span>
        <div class="flex gap-2">
          <button onclick={() => { if (selectedDoor) updateDoor(selectedDoor.id, { flipSide: false }); }} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {!(selectedDoor?.flipSide) ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">Inward</button>
          <button onclick={() => { if (selectedDoor) updateDoor(selectedDoor.id, { flipSide: true }); }} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedDoor?.flipSide ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">Outward</button>
        </div>
      </label>
      {/if}
    </div>

  {:else if selectedWindow}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-cyan-100 rounded flex items-center justify-center text-xs">🪟</span>
      Window Properties
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">Type</span>
        <select value={selectedWindow.type ?? 'standard'} onchange={onWindowType} class="w-full px-2 py-1 border border-gray-200 rounded text-sm">
          <option value="standard">Standard</option>
          <option value="fixed">Fixed</option>
          <option value="casement">Casement</option>
          <option value="sliding">Sliding</option>
          <option value="bay">Bay</option>
        </select>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Width ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedWindow.width)} onchange={onWindowWidth} min="1" class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Distance from A ({unitLabel()})</span>
        <input type="number" value={displayValue(windowDistFromA)} onchange={onWindowDistFromA} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Distance from B ({unitLabel()})</span>
        <input type="number" value={displayValue(windowDistFromB)} onchange={onWindowDistFromB} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Height ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedWindow.height)} onchange={onWindowHeight} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Sill Height ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedWindow.sillHeight)} onchange={onWindowSill} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
    </div>

  {:else if selectedFurniture}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-purple-100 rounded flex items-center justify-center text-xs">
        {getCatalogItem(selectedFurniture.catalogId)?.icon ?? '🪑'}
      </span>
      {getCatalogItem(selectedFurniture.catalogId)?.name ?? 'Furniture'} Properties
      <button
        onclick={() => { if (selectedFurniture) toggleFurnitureLock(selectedFurniture.id); }}
        class="ml-auto px-1.5 py-0.5 rounded text-xs border transition-colors {selectedFurniture.locked ? 'bg-amber-100 border-amber-400 text-amber-700' : 'border-gray-200 hover:bg-gray-50 text-gray-500'}"
        title={selectedFurniture.locked ? 'Unlock (Ctrl+L)' : 'Lock (Ctrl+L)'}
      >{selectedFurniture.locked ? '🔒 Locked' : '🔓'}</button>
    </h3>
    <div class="space-y-3">
      <!-- Color -->
      <div>
        <div class="flex items-center gap-1 mb-2">
          <span class="text-xs text-gray-500">Color</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-400">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        </div>
        <div class="grid grid-cols-5 gap-1.5 mb-2">
          {#each ['#ffffff', '#f5f5dc', '#d2b48c', '#daa520', '#8b4513', '#696969', '#191970', '#000000', '#dc143c', '#228b22'] as color}
            <button
              class="w-6 h-6 rounded border-2 hover:border-gray-300 transition-colors {(selectedFurniture.color ?? getCatalogItem(selectedFurniture.catalogId)?.color) === color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
              style="background-color: {color}"
              title="Color: {color}"
              onclick={() => onFurnitureColor(color)}
            ></button>
          {/each}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">Custom:</span>
          <input 
            type="color" 
            value={selectedFurniture.color ?? getCatalogItem(selectedFurniture.catalogId)?.color ?? '#888888'} 
            oninput={(e) => onFurnitureColor((e.target as HTMLInputElement).value)} 
            class="w-8 h-6 rounded border border-gray-200 cursor-pointer" 
          />
        </div>
      </div>
      
      <!-- Dimensions -->
      <label class="block">
        <span class="text-xs text-gray-500">Width ({unitLabel()})</span>
        <input 
          type="number" 
          value={displayValue(selectedFurniture.width ?? getCatalogItem(selectedFurniture.catalogId)?.width ?? 100)} 
          onchange={onFurnitureWidth} min="1"
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm" 
        />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Depth ({unitLabel()})</span>
        <input 
          type="number" 
          value={displayValue(selectedFurniture.depth ?? getCatalogItem(selectedFurniture.catalogId)?.depth ?? 80)} 
          onchange={onFurnitureDepth} min="1"
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm" 
        />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Height ({unitLabel()})</span>
        <input 
          type="number" 
          value={displayValue(selectedFurniture.height ?? getCatalogItem(selectedFurniture.catalogId)?.height ?? 80)} 
          onchange={onFurnitureHeight} min="1"
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm" 
        />
      </label>
      
      <!-- Material -->
      <label class="block">
        <span class="text-xs text-gray-500">Material</span>
        <select 
          value={selectedFurniture.material ?? 'Wood'} 
          onchange={onFurnitureMaterial} 
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm"
        >
          <option value="Wood">Wood</option>
          <option value="Metal">Metal</option>
          <option value="Fabric">Fabric</option>
          <option value="Leather">Leather</option>
          <option value="Glass">Glass</option>
          <option value="Plastic">Plastic</option>
          <option value="Stone">Stone</option>
          <option value="Ceramic">Ceramic</option>
        </select>
      </label>
      
      <!-- Rotation -->
      <label class="block">
        <span class="text-xs text-gray-500">Rotation (degrees)</span>
        <input 
          type="number" 
          value={Math.round(selectedFurniture.rotation * 100) / 100} 
          onchange={onFurnitureRotation} 
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm" 
        />
      </label>

      <!-- Rotate / Flip controls -->
      <div class="flex gap-1">
        <button
          onclick={() => { if (selectedFurniture) updateFurniture(selectedFurniture.id, { rotation: selectedFurniture.rotation - 90 }); }}
          class="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 transition-colors"
          title="Rotate 90° left"
        >↺ 90°</button>
        <button
          onclick={() => { if (selectedFurniture) updateFurniture(selectedFurniture.id, { rotation: selectedFurniture.rotation + 90 }); }}
          class="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 transition-colors"
          title="Rotate 90° right"
        >↻ 90°</button>
      </div>
      <div class="flex gap-1">
        <button
          onclick={() => { if (selectedFurniture) { const s = selectedFurniture.scale; updateFurniture(selectedFurniture.id, { scale: { x: s.x * -1, y: s.y, z: s.z } }); } }}
          class="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 transition-colors"
          title="Flip horizontally"
        >↔ Flip H</button>
        <button
          onclick={() => { if (selectedFurniture) { const s = selectedFurniture.scale; updateFurniture(selectedFurniture.id, { scale: { x: s.x, y: s.y * -1, z: s.z } }); } }}
          class="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 transition-colors"
          title="Flip vertically"
        >↕ Flip V</button>
      </div>
      
      <!-- Reset button -->
      <button
        onclick={resetFurnitureDefaults}
        class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Reset to defaults
      </button>
    </div>

  {:else if selectedRoom}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-green-100 rounded flex items-center justify-center text-xs">⬜</span>
      Room Properties
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">Room Type</span>
        <select value={selectedRoomType()} onchange={onRoomType} class="w-full px-2 py-1 border border-gray-200 rounded text-sm">
          {#each roomTypes as rt}
            <option value={rt.id}>{rt.icon} {rt.label}</option>
          {/each}
        </select>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Room Name</span>
        <input type="text" value={selectedRoom.name} oninput={onRoomName} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Category</span>
        <select value={selectedRoom.roomType ?? 'indoor'} onchange={(e) => { if (selectedRoom) { const v = (e.target as HTMLSelectElement).value as RoomCategory; updateRoom(selectedRoom.id, { roomType: v }); updateDetectedRoom(selectedRoom.id, { roomType: v } as any); } }} class="w-full px-2 py-1 border border-gray-200 rounded text-sm">
          <option value="indoor">🏠 Indoor</option>
          <option value="outdoor">🌳 Outdoor</option>
          <option value="garage">🚗 Garage</option>
          <option value="utility">🔧 Utility</option>
        </select>
      </label>
      <div>
        <span class="text-xs text-gray-500">Area</span>
        <p class="text-sm text-gray-700">{formatArea(selectedRoom.area, settings.units)}</p>
      </div>
      <!-- Room Color -->
      <div>
        <span class="text-xs text-gray-500 mb-1.5 block">Room Color{selectedRoom.floorTexture === 'none' ? ' (used as floor color)' : ''}</span>
        <div class="grid grid-cols-5 gap-1.5 mb-2">
          {#each roomColorPresets as preset}
            <button
              class="w-7 h-7 rounded-md border-2 hover:border-gray-300 transition-colors {selectedRoom.color === preset.color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
              style="background-color: {preset.color}"
              title={preset.name}
              onclick={() => onRoomColor(preset.color)}
            ></button>
          {/each}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">Custom:</span>
          <input type="color" value={selectedRoom.color ?? '#ffffff'} oninput={(e) => onRoomColor((e.target as HTMLInputElement).value)} class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
        </div>
      </div>
      <div>
        <div class="flex items-center gap-1 mb-2">
          <span class="text-xs text-gray-500">Floor Material</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-400">
            <path d="M3 3h18v18H3z"/>
            <path d="M8 8h8v8H8z"/>
          </svg>
        </div>
        <div class="space-y-3">
          {#each textureGroups as group}
            <div>
              <span class="text-xs font-medium text-gray-600 mb-1.5 block">{group.label}</span>
              <div class="grid grid-cols-3 gap-1.5">
                {#each group.ids as matId}
                  {@const mat = floorMaterials.find(m => m.id === matId)}
                  {#if mat}
                    {@const texPath = floorTexPaths[mat.id] ?? ''}
                    <button
                      class="p-1 rounded-lg border-2 hover:border-gray-300 transition-all text-xs {selectedRoom.floorTexture === mat.id ? 'border-blue-500 ring-2 ring-blue-200 shadow-sm' : 'border-gray-200'}"
                      title={mat.name}
                      onclick={() => onRoomFloor(mat.id)}
                    >
                      <div
                        class="w-full h-12 rounded-md mb-1 overflow-hidden"
                        style={texPath ? `background-image: url(${texPath}); background-size: cover; background-position: center;` : `background-color: ${mat.id === 'none' ? (selectedRoom.color ?? mat.color) : mat.color}`}
                      ></div>
                      <div class="text-center leading-3 text-[10px] text-gray-600 truncate">{mat.name}</div>
                    </button>
                  {/if}
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

  {:else if selectedEntourage}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-green-100 rounded flex items-center justify-center text-xs">🌳</span>
      Entourage
    </h3>
    <div class="space-y-3">
      <div>
        <span class="text-xs text-gray-500">Symbol</span>
        <p class="text-sm text-gray-700">{getEntourageDef(selectedEntourage.defId)?.name ?? 'Custom image'}</p>
      </div>
      <label class="block">
        <span class="text-xs text-gray-500">Width ({unitLabel()})</span>
        <input type="number" value={displayValue(Math.round(selectedEntourage.width))} oninput={(e) => { if (selectedEntourage) updateEntourageItem(selectedEntourage.id, { width: Math.max(1, inputToCm(Number((e.target as HTMLInputElement).value)) || 1) }); }} min="1" class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Rotation (°)</span>
        <input type="number" value={Math.round(selectedEntourage.rotation || 0)} oninput={(e) => { if (selectedEntourage) updateEntourageItem(selectedEntourage.id, { rotation: Number((e.target as HTMLInputElement).value) || 0 }); }} step="15" class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Opacity ({Math.round((selectedEntourage.opacity ?? 1) * 100)}%)</span>
        <input type="range" min="0.1" max="1" step="0.05" value={selectedEntourage.opacity ?? 1} oninput={(e) => { if (selectedEntourage) updateEntourageItem(selectedEntourage.id, { opacity: Number((e.target as HTMLInputElement).value) }); }} class="w-full" />
      </label>
      <div class="flex gap-2">
        <button onclick={() => { if (selectedEntourage) updateEntourageItem(selectedEntourage.id, { locked: !selectedEntourage.locked }); }} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedEntourage.locked ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 hover:bg-gray-50'}">{selectedEntourage.locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
        <button onclick={() => { if (selectedEntourage) { removeElement(selectedEntourage.id); selectedElementId.set(null); } }} class="flex-1 px-2 py-1.5 border border-red-200 text-red-600 rounded text-sm hover:bg-red-50 transition-colors">Delete</button>
      </div>
    </div>

  {:else if selectedStair}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-gray-200 rounded flex items-center justify-center text-xs">🪜</span>
      Stair Properties
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">Type</span>
        <select value={selectedStair.stairType || 'straight'} onchange={(e) => updateStair(selectedStair!.id, { stairType: (e.target as HTMLSelectElement).value as any })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm">
          <option value="straight">Straight</option>
          <option value="l-shaped">L-Shaped</option>
          <option value="u-shaped">U-Shaped</option>
          <option value="spiral">Spiral</option>
        </select>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Width ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedStair.width)} oninput={(e) => updateStair(selectedStair!.id, { width: inputToCm(Number((e.target as HTMLInputElement).value)) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Depth ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedStair.depth)} oninput={(e) => updateStair(selectedStair!.id, { depth: inputToCm(Number((e.target as HTMLInputElement).value)) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Risers</span>
        <input type="number" value={selectedStair.riserCount} min="3" max="30" oninput={(e) => updateStair(selectedStair!.id, { riserCount: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Direction</span>
        <div class="flex gap-2">
          <button onclick={() => updateStair(selectedStair!.id, { direction: 'up' })} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedStair.direction === 'up' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">Up ↑</button>
          <button onclick={() => updateStair(selectedStair!.id, { direction: 'down' })} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedStair.direction === 'down' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">Down ↓</button>
        </div>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Rotation (degrees)</span>
        <input type="number" value={selectedStair.rotation} oninput={(e) => updateStair(selectedStair!.id, { rotation: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
    </div>
  {:else if selectedColumn}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-gray-200 rounded flex items-center justify-center text-xs">🏛️</span>
      Column Properties
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">Shape</span>
        <div class="flex gap-2">
          <button onclick={() => updateColumn(selectedColumn!.id, { shape: 'round' })} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedColumn.shape === 'round' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">⭕ Round</button>
          <button onclick={() => updateColumn(selectedColumn!.id, { shape: 'square' })} class="flex-1 px-2 py-1.5 border rounded text-sm transition-colors {selectedColumn.shape === 'square' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}">⬜ Square</button>
        </div>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">{selectedColumn.shape === 'round' ? 'Diameter' : 'Side Length'} ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedColumn.diameter)} min="10" max="200" oninput={(e) => updateColumn(selectedColumn!.id, { diameter: inputToCm(Number((e.target as HTMLInputElement).value)) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Height ({unitLabel()})</span>
        <input type="number" value={displayValue(selectedColumn.height)} min="50" max="1000" oninput={(e) => updateColumn(selectedColumn!.id, { height: inputToCm(Number((e.target as HTMLInputElement).value)) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <div>
        <span class="text-xs text-gray-500 mb-1.5 block">Color</span>
        <div class="grid grid-cols-5 gap-1.5 mb-2">
          {#each columnColorPresets as preset}
            <button
              class="w-7 h-7 rounded-md border-2 hover:border-gray-300 transition-colors {selectedColumn.color === preset.color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
              style="background-color: {preset.color}"
              title={preset.name}
              onclick={() => updateColumn(selectedColumn!.id, { color: preset.color })}
            ></button>
          {/each}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">Custom:</span>
          <input type="color" value={selectedColumn.color} oninput={(e) => updateColumn(selectedColumn!.id, { color: (e.target as HTMLInputElement).value })} class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
        </div>
      </div>
      {#if selectedColumn.shape === 'square'}
        <label class="block">
          <span class="text-xs text-gray-500">Rotation (degrees)</span>
          <input type="number" value={selectedColumn.rotation} oninput={(e) => updateColumn(selectedColumn!.id, { rotation: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
        </label>
      {/if}
    </div>
  {:else if selectedTextAnnotation}
    <div class="space-y-3">
      <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span class="w-6 h-6 bg-emerald-100 rounded flex items-center justify-center text-xs">🏷️</span>
        Text Annotation
      </h3>
      <label class="block">
        <span class="text-xs text-gray-500">Text</span>
        <input type="text" value={selectedTextAnnotation.text} oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { text: (e.target as HTMLInputElement).value })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Font Size</span>
        <input type="number" value={selectedTextAnnotation.fontSize} min="8" max="72" oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { fontSize: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Color</span>
        <div class="flex items-center gap-2">
          <input type="color" value={selectedTextAnnotation.color} oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { color: (e.target as HTMLInputElement).value })} class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
          <span class="text-xs text-gray-400">{selectedTextAnnotation.color}</span>
        </div>
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Rotation (°)</span>
        <input type="number" value={selectedTextAnnotation.rotation} oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { rotation: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">X</span>
        <input type="number" value={Math.round(selectedTextAnnotation.x)} oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { x: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Y</span>
        <input type="number" value={Math.round(selectedTextAnnotation.y)} oninput={(e) => updateTextAnnotation(selectedTextAnnotation!.id, { y: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
    </div>
  {/if}

  <!-- Background Image Controls (always show when bg image exists) -->
  {#if hasBgImage && floor?.backgroundImage}
    <div class="mt-4 pt-3 border-t border-gray-200">
      <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span class="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-xs">🖼️</span>
        Background Image
      </h3>
      <div class="space-y-3">
        <label class="block">
          <span class="text-xs text-gray-500">Opacity</span>
          <input type="range" min="0.05" max="1" step="0.05" value={floor.backgroundImage.opacity} oninput={(e) => updateBackgroundImage({ opacity: Number((e.target as HTMLInputElement).value) })} class="w-full" />
        </label>
        <label class="block">
          <span class="text-xs text-gray-500">Scale</span>
          <input type="range" min="0.1" max="5" step="0.05" value={floor.backgroundImage.scale} oninput={(e) => updateBackgroundImage({ scale: Number((e.target as HTMLInputElement).value) })} class="w-full" />
        </label>
        <label class="block">
          <span class="text-xs text-gray-500">Rotation</span>
          <input type="number" value={floor.backgroundImage.rotation} oninput={(e) => updateBackgroundImage({ rotation: Number((e.target as HTMLInputElement).value) })} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
        </label>
        <div class="flex gap-2">
          <button
            onclick={() => updateBackgroundImage({ locked: !floor!.backgroundImage!.locked })}
            class="flex-1 px-2 py-1.5 border rounded text-sm {floor.backgroundImage.locked ? 'bg-amber-100 border-amber-400 text-amber-700' : 'border-gray-200 hover:bg-gray-50'}"
          >{floor.backgroundImage.locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
          <button
            onclick={() => { calibrationPoints.set([]); calibrationMode.set(true); }}
            class="flex-1 px-2 py-1.5 border rounded text-sm border-gray-200 hover:bg-gray-50"
          >📏 Set Scale</button>
        </div>
        <button
          onclick={() => setBackgroundImage(undefined)}
          class="w-full px-2 py-1.5 border border-red-300 rounded text-sm text-red-600 hover:bg-red-50"
        >Remove Image</button>
      </div>
    </div>
  {/if}
</div>
