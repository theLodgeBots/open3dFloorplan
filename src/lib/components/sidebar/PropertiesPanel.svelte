<script lang="ts">
  import { activeFloor, selectedElementId, selectedRoomId, updateWall, updateDoor, updateWindow, updateRoom, updateFurniture, detectedRoomsStore } from '$lib/stores/project';
  import { floorMaterials, wallColors } from '$lib/utils/materials';
  import { getCatalogItem } from '$lib/utils/furnitureCatalog';
  import type { Floor, Wall, Door, Window as Win, Room, FurnitureItem } from '$lib/models/types';

  let floor: Floor | null = $state(null);
  let selId: string | null = $state(null);
  let selRoomId: string | null = $state(null);
  let detectedRooms: Room[] = $state([]);

  activeFloor.subscribe((f) => { floor = f; });
  selectedElementId.subscribe((id) => { selId = id; });
  selectedRoomId.subscribe((id) => { selRoomId = id; });
  detectedRoomsStore.subscribe((rooms) => { detectedRooms = rooms; });

  let selectedWall = $derived(floor?.walls.find(w => w.id === selId) ?? null);
  let selectedDoor = $derived(floor?.doors.find(d => d.id === selId) ?? null);
  let selectedWindow = $derived(floor?.windows.find(w => w.id === selId) ?? null);
  let selectedFurniture = $derived(floor?.furniture.find(f => f.id === selId) ?? null);
  let selectedRoom = $derived(floor?.rooms.find(r => r.id === selRoomId) ?? detectedRooms.find(r => r.id === selRoomId) ?? null);

  // Helper to get the parent wall for selected door/window
  let selectedDoorWall = $derived((selectedDoor && floor?.walls.find(w => w.id === selectedDoor.wallId)) ?? null);
  let selectedWindowWall = $derived((selectedWindow && floor?.walls.find(w => w.id === selectedWindow.wallId)) ?? null);

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

  function onWallThickness(e: Event) {
    if (!selectedWall) return;
    updateWall(selectedWall.id, { thickness: Number((e.target as HTMLInputElement).value) });
  }
  function onWallHeight(e: Event) {
    if (!selectedWall) return;
    updateWall(selectedWall.id, { height: Number((e.target as HTMLInputElement).value) });
  }
  function onWallColor(e: Event) {
    if (!selectedWall) return;
    updateWall(selectedWall.id, { color: (e.target as HTMLInputElement).value });
  }
  function onDoorWidth(e: Event) {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { width: Number((e.target as HTMLInputElement).value) });
  }
  function onDoorHeight(e: Event) {
    if (!selectedDoor) return;
    updateDoor(selectedDoor.id, { height: Number((e.target as HTMLInputElement).value) });
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
    updateWindow(selectedWindow.id, { width: Number((e.target as HTMLInputElement).value) });
  }
  function onWindowHeight(e: Event) {
    if (!selectedWindow) return;
    updateWindow(selectedWindow.id, { height: Number((e.target as HTMLInputElement).value) });
  }
  function onWindowSill(e: Event) {
    if (!selectedWindow) return;
    updateWindow(selectedWindow.id, { sillHeight: Number((e.target as HTMLInputElement).value) });
  }

  // Furniture handlers
  function onFurnitureColor(color: string) {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { color });
  }
  function onFurnitureWidth(e: Event) {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { width: Number((e.target as HTMLInputElement).value) });
  }
  function onFurnitureDepth(e: Event) {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { depth: Number((e.target as HTMLInputElement).value) });
  }
  function onFurnitureHeight(e: Event) {
    if (!selectedFurniture) return;
    updateFurniture(selectedFurniture.id, { height: Number((e.target as HTMLInputElement).value) });
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
    const newDistFromA = Number((e.target as HTMLInputElement).value);
    const wallLen = calcWallLength(selectedDoorWall);
    const newPosition = Math.max(0.05, Math.min(0.95, newDistFromA / wallLen));
    updateDoor(selectedDoor.id, { position: newPosition });
  }
  
  function onDoorDistFromB(e: Event) {
    if (!selectedDoor || !selectedDoorWall) return;
    const newDistFromB = Number((e.target as HTMLInputElement).value);
    const wallLen = calcWallLength(selectedDoorWall);
    const newPosition = Math.max(0.05, Math.min(0.95, 1 - (newDistFromB / wallLen)));
    updateDoor(selectedDoor.id, { position: newPosition });
  }

  // Window distance handlers
  function onWindowDistFromA(e: Event) {
    if (!selectedWindow || !selectedWindowWall) return;
    const newDistFromA = Number((e.target as HTMLInputElement).value);
    const wallLen = calcWallLength(selectedWindowWall);
    const newPosition = Math.max(0.05, Math.min(0.95, newDistFromA / wallLen));
    updateWindow(selectedWindow.id, { position: newPosition });
  }
  
  function onWindowDistFromB(e: Event) {
    if (!selectedWindow || !selectedWindowWall) return;
    const newDistFromB = Number((e.target as HTMLInputElement).value);
    const wallLen = calcWallLength(selectedWindowWall);
    const newPosition = Math.max(0.05, Math.min(0.95, 1 - (newDistFromB / wallLen)));
    updateWindow(selectedWindow.id, { position: newPosition });
  }
  function updateDetectedRoom(id: string, updates: Partial<{ name: string; floorTexture: string }>) {
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

  let hasSelection = $derived(!!selectedWall || !!selectedDoor || !!selectedWindow || !!selectedFurniture || !!selectedRoom);
</script>

{#if hasSelection}
<div class="w-64 bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto p-3">
  {#if selectedWall}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-gray-200 rounded flex items-center justify-center text-xs">▭</span>
      Wall Properties
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">Length (cm)</span>
        <input type="number" value={wallLength} disabled class="w-full px-2 py-1 border border-gray-200 rounded text-sm bg-gray-50" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Thickness (cm)</span>
        <input type="number" value={selectedWall.thickness} oninput={onWallThickness} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Height (cm)</span>
        <input type="number" value={selectedWall.height} oninput={onWallHeight} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
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
      <div>
        <div class="flex items-center gap-1 mb-2">
          <span class="text-xs text-gray-500">Wall Color</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-400">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        </div>
        <div class="grid grid-cols-6 gap-1.5">
          {#each wallColors as wc}
            <button
              class="w-7 h-7 rounded-md border-2 hover:border-gray-300 transition-colors {selectedWall.color === wc.color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
              style="background-color: {wc.color}"
              title={wc.name}
              onclick={() => { if (selectedWall) updateWall(selectedWall.id, { color: wc.color }); }}
            ></button>
          {/each}
        </div>
        <div class="mt-2">
          <label class="flex items-center gap-2">
            <span class="text-xs text-gray-500">Custom:</span>
            <input type="color" value={selectedWall.color} oninput={onWallColor} class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
          </label>
        </div>
      </div>
    </div>

  {:else if selectedDoor}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-amber-100 rounded flex items-center justify-center text-xs">🚪</span>
      Door Properties
    </h3>
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-gray-500">Width (cm)</span>
        <input type="number" value={selectedDoor.width} oninput={onDoorWidth} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Distance from A (cm)</span>
        <input type="number" value={doorDistFromA} oninput={onDoorDistFromA} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Distance from B (cm)</span>
        <input type="number" value={doorDistFromB} oninput={onDoorDistFromB} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Height (cm)</span>
        <input type="number" value={selectedDoor.height ?? 210} oninput={onDoorHeight} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
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
        </select>
      </label>
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
        <span class="text-xs text-gray-500">Width (cm)</span>
        <input type="number" value={selectedWindow.width} oninput={onWindowWidth} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Distance from A (cm)</span>
        <input type="number" value={windowDistFromA} oninput={onWindowDistFromA} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Distance from B (cm)</span>
        <input type="number" value={windowDistFromB} oninput={onWindowDistFromB} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Height (cm)</span>
        <input type="number" value={selectedWindow.height} oninput={onWindowHeight} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Sill Height (cm)</span>
        <input type="number" value={selectedWindow.sillHeight} oninput={onWindowSill} class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
      </label>
    </div>

  {:else if selectedFurniture}
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span class="w-6 h-6 bg-purple-100 rounded flex items-center justify-center text-xs">
        {getCatalogItem(selectedFurniture.catalogId)?.icon ?? '🪑'}
      </span>
      {getCatalogItem(selectedFurniture.catalogId)?.name ?? 'Furniture'} Properties
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
        <span class="text-xs text-gray-500">Width (cm)</span>
        <input 
          type="number" 
          value={selectedFurniture.width ?? getCatalogItem(selectedFurniture.catalogId)?.width ?? 100} 
          oninput={onFurnitureWidth} 
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm" 
        />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Depth (cm)</span>
        <input 
          type="number" 
          value={selectedFurniture.depth ?? getCatalogItem(selectedFurniture.catalogId)?.depth ?? 80} 
          oninput={onFurnitureDepth} 
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm" 
        />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">Height (cm)</span>
        <input 
          type="number" 
          value={selectedFurniture.height ?? getCatalogItem(selectedFurniture.catalogId)?.height ?? 80} 
          oninput={onFurnitureHeight} 
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
          value={selectedFurniture.rotation} 
          oninput={onFurnitureRotation} 
          class="w-full px-2 py-1 border border-gray-200 rounded text-sm" 
        />
      </label>
      
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
      <div>
        <span class="text-xs text-gray-500">Area</span>
        <p class="text-sm text-gray-700">{selectedRoom.area} m²</p>
      </div>
      <div>
        <div class="flex items-center gap-1 mb-2">
          <span class="text-xs text-gray-500">Floor Material</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-400">
            <path d="M3 3h18v18H3z"/>
            <path d="M8 8h8v8H8z"/>
          </svg>
        </div>
        <div class="grid grid-cols-3 gap-2">
          {#each floorMaterials as mat}
            <button
              class="p-2 rounded-lg border-2 hover:border-gray-300 transition-colors text-xs {selectedRoom.floorTexture === mat.id ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}"
              title={mat.name}
              onclick={() => onRoomFloor(mat.id)}
            >
              <div class="w-full h-7 rounded-md mb-1.5 relative overflow-hidden" style="background-color: {mat.color}">
                {#if mat.pattern === 'hardwood' || mat.pattern === 'bamboo' || mat.pattern === 'laminate'}
                  <!-- Wood grain pattern -->
                  <div class="absolute inset-0 opacity-20" style="background: repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)"></div>
                {:else if mat.pattern === 'tile'}
                  <!-- Tile grid pattern -->
                  <div class="absolute inset-0 opacity-30" style="background: repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(255,255,255,0.3) 6px, rgba(255,255,255,0.3) 7px), repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.3) 6px, rgba(255,255,255,0.3) 7px)"></div>
                {:else if mat.pattern === 'carpet'}
                  <!-- Carpet texture -->
                  <div class="absolute inset-0 opacity-40" style="background: repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 2px)"></div>
                {:else if mat.pattern === 'marble'}
                  <!-- Marble veins -->
                  <div class="absolute inset-0 opacity-20" style="background: radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, transparent 50%)"></div>
                {/if}
                <!-- Small pattern indicator icon -->
                <div class="absolute bottom-0 right-0 text-black text-opacity-30 text-xs">
                  {#if mat.pattern === 'hardwood' || mat.pattern === 'bamboo' || mat.pattern === 'laminate'}
                    ═
                  {:else if mat.pattern === 'tile'}
                    ⊞
                  {:else if mat.pattern === 'carpet'}
                    ≈
                  {:else if mat.pattern === 'marble'}
                    ◊
                  {:else}
                    ▪
                  {/if}
                </div>
              </div>
              <div class="text-center leading-3">{mat.name}</div>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
{/if}
