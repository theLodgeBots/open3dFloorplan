import { selectedTool, undo, redo, viewMode, selectedElementId, selectedElementIds, removeElement, panMode } from '$lib/stores/project';
import { get } from 'svelte/store';
import { localStore } from '$lib/services/datastore';
import { currentProject } from '$lib/stores/project';

export interface ShortcutContext {
  rotateFurniture?: () => void;
  save?: () => void;
}

export function handleGlobalShortcut(e: KeyboardEvent, ctx: ShortcutContext = {}): boolean {
  const mod = e.metaKey || e.ctrlKey;

  // Ctrl+Z undo
  if (mod && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
    return true;
  }
  // Ctrl+Y or Ctrl+Shift+Z redo
  if ((mod && e.key === 'y') || (mod && e.key === 'z' && e.shiftKey)) {
    e.preventDefault();
    redo();
    return true;
  }
  // Ctrl+S save
  if (mod && e.key === 's') {
    e.preventDefault();
    if (ctx.save) ctx.save();
    else {
      const p = get(currentProject);
      if (p) localStore.save(p);
    }
    return true;
  }

  // Don't handle single-key shortcuts if user is typing in an input
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;

  if (e.key === 'Escape') {
    selectedTool.set('select');
    selectedElementId.set(null);
    selectedElementIds.set(new Set());
    return true;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const multiIds = get(selectedElementIds);
    if (multiIds.size > 0) {
      for (const id of multiIds) removeElement(id);
      selectedElementIds.set(new Set());
      selectedElementId.set(null);
    } else {
      const id = get(selectedElementId);
      if (id) { removeElement(id); selectedElementId.set(null); }
    }
    return true;
  }
  if (e.key === 'w' || e.key === 'W') { selectedTool.set('wall'); panMode.set(false); return true; }
  if (e.key === 'd' || e.key === 'D') { selectedTool.set('door'); panMode.set(false); return true; }
  if (e.key === 'v' || e.key === 'V') { selectedTool.set('select'); panMode.set(false); return true; }
  if (e.key === 'h' || e.key === 'H') { panMode.set(true); return true; }
  if (e.key === 'r' || e.key === 'R') {
    if (ctx.rotateFurniture) ctx.rotateFurniture();
    return true;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const m = get(viewMode);
    viewMode.set(m === '2d' ? '3d' : '2d');
    return true;
  }
  if (e.key === 'g' || e.key === 'G') {
    // Handled in canvas component
    return false;
  }
  return false;
}
