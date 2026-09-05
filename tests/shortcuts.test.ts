import { beforeEach, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { activateMeasurementTool, selectedTool, placingFurnitureId, placingStair, placingColumn,
  placingEntourageId, calibrationMode, elevationPickMode, panMode } from '$lib/stores/project';
import { handleGlobalShortcut } from '$lib/utils/shortcuts';
import { manualSave } from '$lib/stores/saveStatus';

vi.mock('$lib/stores/saveStatus', () => ({ manualSave: vi.fn().mockResolvedValue(true) }));
function keyEvent(key: string, extra = {}) {
  return { key, preventDefault: vi.fn(), target: { tagName: 'CANVAS' }, ...extra } as unknown as KeyboardEvent;
}
beforeEach(() => { selectedTool.set('select'); vi.mocked(manualSave).mockClear(); });

it.each(['measure', 'annotate'] as const)('activates %s and disarms conflicting placement modes', tool => {
  placingFurnitureId.set('chair'); placingStair.set(true); placingColumn.set(true);
  placingEntourageId.set('tree'); calibrationMode.set(true); elevationPickMode.set(true); panMode.set(true);
  activateMeasurementTool(tool);
  expect(get(selectedTool)).toBe(tool);
  expect(get(placingFurnitureId)).toBeNull();
  expect(get(placingEntourageId)).toBeNull();
  for (const store of [placingStair, placingColumn, calibrationMode, elevationPickMode, panMode]) expect(get(store)).toBe(false);
});

it('uses the same selection for N/M, toggles off, and exits with Escape', () => {
  expect(handleGlobalShortcut(keyEvent('N'))).toBe(true);
  expect(get(selectedTool)).toBe('annotate');
  handleGlobalShortcut(keyEvent('m'));
  expect(get(selectedTool)).toBe('measure');
  handleGlobalShortcut(keyEvent('m'));
  expect(get(selectedTool)).toBe('select');
  handleGlobalShortcut(keyEvent('n'));
  handleGlobalShortcut(keyEvent('Escape'));
  expect(get(selectedTool)).toBe('select');
});

it('does not activate measurement tools while typing or using modified shortcuts', () => {
  for (const extra of [{ target: { tagName: 'INPUT' } }, { metaKey: true }, { ctrlKey: true }, { altKey: true }]) {
    expect(handleGlobalShortcut(keyEvent('n', extra))).toBe(false);
    expect(get(selectedTool)).toBe('select');
  }
});

it('routes Cmd/Ctrl+S through the same save status and error handling as the Save button', () => {
  handleGlobalShortcut(keyEvent('s', { metaKey: true }));
  handleGlobalShortcut(keyEvent('s', { ctrlKey: true }));
  expect(manualSave).toHaveBeenCalledTimes(2);
});
