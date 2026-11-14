// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Runs fn once on the next animation frame, or after ms when no frame comes (a hidden pane, a busy device), so DOM
// work that waits for a frame never waits for ever. Whichever fires first wins; the other is cancelled.
export function onNextFrame(fn, ms = 250, g = globalThis) {
  let done = false;
  let rafId = null;
  let timer = null;
  const run = () => {
    if (done) return;
    done = true;
    if (rafId !== null && typeof g.cancelAnimationFrame === "function") g.cancelAnimationFrame(rafId);
    if (timer !== null) g.clearTimeout(timer);
    fn();
  };
  if (typeof g.requestAnimationFrame === "function") rafId = g.requestAnimationFrame(run);
  if (!done) timer = g.setTimeout(run, typeof g.requestAnimationFrame === "function" ? ms : 0);
  return () => {
    done = true;
    if (rafId !== null && typeof g.cancelAnimationFrame === "function") g.cancelAnimationFrame(rafId);
    if (timer !== null) g.clearTimeout(timer);
  };
}
