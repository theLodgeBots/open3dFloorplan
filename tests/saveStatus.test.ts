import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Project } from '$lib/models/types';
import { localStore, ProjectConflictError } from '$lib/services/datastore';
import { createDefaultProject, currentProject, updateProjectName } from '$lib/stores/project';
import { autoSave, initAutoSave, lastSavedAt, manualSave, markClean, saveError, saveState, saveConflict, saveCurrentAsCopy, savingCopy } from '$lib/stores/saveStatus';

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

it('saves immediately but captures a thumbnail only after the canvas redraws', async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  let renderedPlan = 'previous plan';
  const drawImage = vi.fn();
  vi.stubGlobal('document', {
    querySelector: () => ({ width: 600, height: 400 }),
    createElement: () => ({ getContext: () => ({ drawImage }), toDataURL: () => renderedPlan }),
  });
  const preview = vi.spyOn(localStore, 'saveThumbnail').mockImplementation(() => {});
  expect(await autoSave()).toBe(true);
  expect(get(saveState)).toBe('saved');
  expect(preview).not.toHaveBeenCalled();
  frames.shift()!(0);
  renderedPlan = 'current plan';
  frames.shift()!(16);
  expect(preview).toHaveBeenCalledWith(get(currentProject)!.id, 'current plan');
});

it('discards delayed thumbnail work after a later edit or project switch', async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  const querySelector = vi.fn();
  vi.stubGlobal('document', { querySelector });
  await autoSave();
  updateProjectName('Newer revision');
  frames.shift()!(0); frames.shift()!(16);
  expect(querySelector).not.toHaveBeenCalled();
  await autoSave();
  currentProject.set(createDefaultProject('Another plan'));
  markClean();
  frames.shift()!(32); frames.shift()!(48);
  expect(querySelector).not.toHaveBeenCalled();
});

it('keeps conflicting edits unsaved without repeatedly autosaving over another tab', async () => {
  vi.mocked(localStore.save).mockRejectedValue(new ProjectConflictError());
  updateProjectName('My version');
  expect(await manualSave()).toBe(false);
  expect(get(saveConflict)).toBe(true);
  expect(get(saveError)).toContain('another tab');
  updateProjectName('More local edits');
  await vi.advanceTimersByTimeAsync(2000);
  expect(localStore.save).toHaveBeenCalledOnce();
  expect(get(saveState)).toBe('unsaved');
});

it('notifies about external project changes without replacing local work and removes its listener', async () => {
  stop();
  const events = new EventTarget();
  vi.stubGlobal('window', events);
  const removed = vi.spyOn(events, 'removeEventListener');
  const check = vi.spyOn(localStore, 'assertCurrent').mockImplementation(() => { throw new ProjectConflictError(); });
  stop = initAutoSave();
  const before = get(currentProject);
  events.dispatchEvent(Object.assign(new Event('storage'), { key: 'floorplan_projects' }));
  expect(get(saveState)).toBe('unsaved'); expect(get(saveConflict)).toBe(true);
  expect(get(currentProject)).toBe(before);
  stop(); expect(removed).toHaveBeenCalledWith('storage', expect.any(Function));
  events.dispatchEvent(Object.assign(new Event('storage'), { key: 'floorplan_projects' }));
  expect(check).toHaveBeenCalledOnce();
});

it('ignores unrelated storage events and other project writes', () => {
  stop();
  const events = new EventTarget(); vi.stubGlobal('window', events);
  const check = vi.spyOn(localStore, 'assertCurrent').mockImplementation(() => {});
  stop = initAutoSave();
  events.dispatchEvent(Object.assign(new Event('storage'), { key: 'settings' }));
  expect(check).not.toHaveBeenCalled();
  events.dispatchEvent(Object.assign(new Event('storage'), { key: 'floorplan_projects' }));
  expect(get(saveState)).toBe('saved'); expect(get(saveConflict)).toBe(false);
});

it('switches to a recovery copy only after that copy is saved', async () => {
  updateProjectName('Recover me'); saveConflict.set(true);
  const copy = { ...get(currentProject)!, id: 'recovered', name: 'Recover me (Recovered copy)' };
  vi.spyOn(localStore, 'saveCopy').mockResolvedValue(copy);
  expect(await saveCurrentAsCopy()).toBe(true);
  expect(get(currentProject)).toBe(copy);
  expect(get(saveState)).toBe('saved'); expect(get(saveConflict)).toBe(false);
  expect(get(lastSavedAt)).toBeInstanceOf(Date); expect(get(savingCopy)).toBe(false);
  await vi.advanceTimersByTimeAsync(2000);
  expect(localStore.save).not.toHaveBeenCalled();
});

it('retains conflicting work and its retry option if saving a copy fails', async () => {
  updateProjectName('Keep me in memory'); saveConflict.set(true);
  const before = get(currentProject);
  vi.spyOn(localStore, 'saveCopy').mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
  expect(await saveCurrentAsCopy()).toBe(false);
  expect(get(currentProject)).toBe(before);
  expect(get(saveState)).toBe('unsaved'); expect(get(saveConflict)).toBe(true);
  expect(get(saveError)).toContain('Browser storage is full');
  expect(get(savingCopy)).toBe(false);
});

it('does not discard edits made while a recovery copy is being saved', async () => {
  updateProjectName('Copy this revision'); saveConflict.set(true);
  let finish!: (value: Project) => void;
  const copy = { ...get(currentProject)!, id: 'recovered' };
  vi.spyOn(localStore, 'saveCopy').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const pending = saveCurrentAsCopy();
  expect(await saveCurrentAsCopy()).toBe(false);
  updateProjectName('Later edits');
  finish(copy); expect(await pending).toBe(false);
  expect(get(currentProject)!.name).toBe('Later edits');
  expect(get(saveError)).toContain('made more edits');
  expect(get(saveState)).toBe('unsaved'); expect(get(saveConflict)).toBe(true);
});
