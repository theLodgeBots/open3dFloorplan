import { beforeEach, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { currentProject } from '$lib/stores/project';
import { autoSave, saveState } from '$lib/stores/saveStatus';
import { prepareToLeave } from '$lib/services/deployment';
import { roomProject } from './fixtures/project';

vi.mock('$lib/stores/saveStatus', async () => {
  const { writable } = await import('svelte/store');
  return { autoSave: vi.fn(), saveState: writable('unsaved') };
});

beforeEach(() => { vi.mocked(autoSave).mockReset(); currentProject.set(roomProject()); saveState.set('unsaved'); });

it('blocks a reload after a failed local save and retains the in-memory project', async () => {
  const project = get(currentProject);
  vi.mocked(autoSave).mockResolvedValue(false);
  expect(await prepareToLeave()).toBe(false);
  expect(get(currentProject)).toBe(project);
});

it('allows navigation only after the current revision has been saved', async () => {
  vi.mocked(autoSave).mockImplementation(async () => { saveState.set('saved'); return true; });
  expect(await prepareToLeave()).toBe(true);
  expect(autoSave).toHaveBeenCalledOnce();
});

it('blocks reloading when a new edit or replacement project arrives during the save', async () => {
  vi.mocked(autoSave).mockResolvedValue(true);
  expect(await prepareToLeave()).toBe(false);
  vi.mocked(autoSave).mockImplementation(async () => { currentProject.set(roomProject()); saveState.set('saved'); return true; });
  expect(await prepareToLeave()).toBe(false);
});

it('does not write again for an already saved project', async () => {
  saveState.set('saved');
  expect(await prepareToLeave()).toBe(true);
  expect(autoSave).not.toHaveBeenCalled();
});
