/** Owns every timer, frame and listener of one tour run, so ending the run or unmounting leaves nothing behind. */

export interface Scope {
  readonly disposed: boolean;
  timeout(fn: () => void, ms: number): void;
  frame(fn: (now: number) => void): void;
  listen<K extends string>(target: EventTarget, type: K, fn: (e: Event) => void, options?: AddEventListenerOptions | boolean): void;
  /** Resolves after ms, or never when the scope is disposed first. */
  sleep(ms: number): Promise<void>;
  dispose(): void;
  readonly pending: number;
}

export function createScope(): Scope {
  let disposed = false;
  const timers = new Set<ReturnType<typeof setTimeout>>(), frames = new Set<number>();
  const listeners: (() => void)[] = [];
  const scope: Scope = {
    get disposed() { return disposed; },
    get pending() { return timers.size + frames.size + listeners.length; },
    timeout(fn, ms) {
      if (disposed) return;
      const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
      timers.add(id);
    },
    frame(fn) {
      if (disposed) return;
      if (typeof requestAnimationFrame !== 'function') { scope.timeout(() => fn(Date.now()), 16); return; }
      const id = requestAnimationFrame(now => { frames.delete(id); if (!disposed) fn(now); });
      frames.add(id);
    },
    listen(target, type, fn, options) {
      if (disposed) return;
      target.addEventListener(type, fn, options);
      listeners.push(() => target.removeEventListener(type, fn, options));
    },
    sleep(ms) { return new Promise(resolve => scope.timeout(resolve, ms)); },
    dispose() {
      if (disposed) return;
      disposed = true;
      timers.forEach(clearTimeout); timers.clear();
      if (typeof cancelAnimationFrame === 'function') frames.forEach(cancelAnimationFrame);
      frames.clear();
      listeners.splice(0).forEach(off => off());
    },
  };
  return scope;
}
