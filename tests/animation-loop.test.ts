import { expect, it, vi } from 'vitest';
import { startAnimationLoop } from '$lib/utils/animationLoop';

it('keeps one outstanding frame and stops all drawing after teardown', () => {
  const queue = new Map<number, FrameRequestCallback>();
  let id = 0;
  const request = (callback: FrameRequestCallback) => { queue.set(++id, callback); return id; };
  const cancel = (id: number) => { queue.delete(id); };
  const draw = vi.fn();
  const stop = startAnimationLoop(draw, request, cancel);
  for (let i = 0; i < 20; i++) {
    expect(queue.size).toBe(1);
    const [id, callback] = [...queue][0];
    queue.delete(id); callback(i);
  }
  expect(draw).toHaveBeenCalledTimes(20);
  const lateFrame = [...queue.values()][0];
  stop();
  expect(queue.size).toBe(0);
  lateFrame(30);
  expect(draw).toHaveBeenCalledTimes(20);
});

it('does not schedule another frame if drawing closes the view', () => {
  let callback: FrameRequestCallback;
  const request = vi.fn((fn: FrameRequestCallback) => { callback = fn; return 1; });
  const stop = startAnimationLoop(() => stop(), request, vi.fn());
  callback!(0);
  expect(request).toHaveBeenCalledOnce();
});
