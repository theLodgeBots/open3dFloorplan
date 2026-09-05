import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { localStore } from '$lib/services/datastore';
import { createDefaultProject, currentProject, updateProjectName } from '$lib/stores/project';
import { autoSave, initAutoSave, lastSavedAt, manualSave, markClean, saveError, saveState } from '$lib/stores/saveStatus';

vi.mock('$lib/stores/versionHistory', () => ({ saveSnapshot: vi.fn() }));
let stop: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  currentProject.set(createDefaultProject());
  markClean();
  stop = initAutoSave();
  vi.spyOn(localStore, 'save').mockResolvedValue();
});

afterEach(() => { stop(); vi.useRealTimers(); });

it('debounces edits into one local write and only then reports Saved', async () => {
  updateProjectName('A');
  await vi.advanceTimersByTimeAsync(600);
  updateProjectName('B');
  expect(get(saveState)).toBe('unsaved');
  await vi.advanceTimersByTimeAsync(600);
  expect(localStore.save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(400);
  expect(localStore.save).toHaveBeenCalledTimes(1);
  expect(get(saveState)).toBe('saved');
  expect(get(lastSavedAt)).toBeInstanceOf(Date);
});

it('shows a quota failure without a false success and supports retry', async () => {
  vi.mocked(localStore.save).mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'));
  updateProjectName('Keep this edit');
  expect(await manualSave()).toBe(false);
  expect(get(saveState)).toBe('unsaved');
  expect(get(saveError)).toContain('Browser storage is full');
  expect(get(lastSavedAt)).toBeNull();
  expect(get(currentProject)?.name).toBe('Keep this edit');
  expect(await manualSave()).toBe(true);
  expect(get(saveState)).toBe('saved');
  expect(get(saveError)).toBeNull();
  await vi.advanceTimersByTimeAsync(2000);
  expect(localStore.save).toHaveBeenCalledTimes(2);
});

it('reports autosave failure without an unhandled rejection', async () => {
  vi.mocked(localStore.save).mockRejectedValue(new DOMException('Denied', 'SecurityError'));
  updateProjectName('Keep this too');
  await vi.advanceTimersByTimeAsync(1000);
  expect(get(saveState)).toBe('unsaved');
  expect(get(saveError)).toContain('Browser storage is unavailable');
});

it('does not mark edits made during a pending write as saved', async () => {
  let finish!: () => void;
  vi.mocked(localStore.save).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  updateProjectName('First edit');
  const pending = autoSave();
  updateProjectName('Later edit');
  finish();
  await pending;
  expect(get(saveState)).toBe('unsaved');
  await vi.advanceTimersByTimeAsync(1000);
  expect(get(saveState)).toBe('saved');
});

it('does not let a previous project write overwrite the next project save status', async () => {
  let fail!: (reason: Error) => void;
  vi.mocked(localStore.save).mockImplementationOnce(() => new Promise<void>((_, reject) => { fail = reject; }));
  const pending = autoSave();
  currentProject.set(createDefaultProject('Next'));
  markClean();
  fail(new Error('Previous project failed'));
  await pending;
  expect(get(saveState)).toBe('saved');
  expect(get(saveError)).toBeNull();
});

it('cleans up the subscription and timer when leaving the editor', async () => {
  updateProjectName('Pending');
  stop();
  await vi.advanceTimersByTimeAsync(2000);
  expect(localStore.save).not.toHaveBeenCalled();
  markClean();
  stop = initAutoSave();
  updateProjectName('Reopened');
  await vi.advanceTimersByTimeAsync(1000);
  expect(localStore.save).toHaveBeenCalledTimes(1);
});

it('does not skip the first real edit after loading a saved project', async () => {
  markClean();
  updateProjectName('First edit after load');
  expect(get(saveState)).toBe('unsaved');
  await vi.advanceTimersByTimeAsync(1000);
  expect(localStore.save).toHaveBeenCalledTimes(1);
});

it('does not show another project\'s save time if creation fails outside the editor', async () => {
  await autoSave();
  expect(get(lastSavedAt)).toBeInstanceOf(Date);
  stop();
  currentProject.set(createDefaultProject('New unsaved project'));
  vi.mocked(localStore.save).mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'));
  expect(await autoSave()).toBe(false);
  expect(get(lastSavedAt)).toBeNull();
  expect(get(saveError)).toContain('Browser storage is full');
});
