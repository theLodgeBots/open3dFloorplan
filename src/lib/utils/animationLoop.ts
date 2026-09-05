/** One outstanding frame, with teardown that also works when stopped inside a frame. */
export function startAnimationLoop(
  draw: () => void,
  request: typeof requestAnimationFrame = requestAnimationFrame,
  cancel: typeof cancelAnimationFrame = cancelAnimationFrame,
): () => void {
  let running = true;
  let frame = 0;
  const tick = () => {
    if (!running) return;
    draw();
    if (running) frame = request(tick);
  };
  frame = request(tick);
  return () => { running = false; cancel(frame); };
}
