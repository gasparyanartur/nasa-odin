import { describe, expect, it, vi } from 'vitest';
import { LayerSlot, type LayerHandle } from './layer-slot';

const handle = (): LayerHandle => ({ setVisible: vi.fn(), setOpacity: vi.fn(), dispose: vi.fn() });
function deferred() {
  let resolve!: (value: LayerHandle) => void;
  const promise = new Promise<LayerHandle>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('one replaceable layer', () => {
  it('retains only one live layer after repeated swaps and none after disposal', async () => {
    const live = new Set<LayerHandle>();
    const slot = new LayerSlot(async () => {
      const layer = handle();
      layer.dispose = () => { live.delete(layer); };
      live.add(layer);
      return layer;
    });
    for (let i = 0; i < 20; i++) { await slot.replace(i); expect(live.size).toBe(1); }
    slot.dispose();
    expect(live.size).toBe(0);
  });
  it('preserves controls and disposes every replaced layer once', async () => {
    const first = handle(), next = handle();
    const create = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(next);
    const slot = new LayerSlot(create);
    await slot.replace('first');
    slot.setVisible(false); slot.setOpacity(.42);
    await slot.replace('next');
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(next.setVisible).toHaveBeenCalledWith(false);
    expect(next.setOpacity).toHaveBeenCalledWith(.42);
    slot.dispose();
    expect(next.dispose).toHaveBeenCalledTimes(1);
  });
  it('keeps the current layer when creating its replacement fails', async () => {
    const active = handle();
    const slot = new LayerSlot(vi.fn().mockResolvedValueOnce(active).mockRejectedValueOnce(new Error('offline')));
    await slot.replace('first');
    await expect(slot.replace('bad')).rejects.toThrow('offline');
    expect(active.dispose).not.toHaveBeenCalled();
  });
  it('discards a slow request after a newer replacement', async () => {
    const slow = deferred(), stale = handle(), latest = handle();
    const slot = new LayerSlot(vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValueOnce(latest));
    const oldRequest = slot.replace('slow');
    await slot.replace('latest');
    slow.resolve(stale);
    expect(await oldRequest).toBe(false);
    expect(stale.dispose).toHaveBeenCalledTimes(1);
    expect(latest.dispose).not.toHaveBeenCalled();
  });
  it('cleans up a request that completes after unmount', async () => {
    const pending = deferred(), late = handle();
    const slot = new LayerSlot(() => pending.promise);
    const result = slot.replace('late'); slot.dispose(); pending.resolve(late);
    expect(await result).toBe(false);
    expect(late.dispose).toHaveBeenCalledTimes(1);
  });
  it('invalidates unfinished work while a new manifest is being read', async () => {
    const pending = deferred(), stale = handle();
    const slot = new LayerSlot(() => pending.promise);
    const result = slot.replace('old'); slot.invalidatePending(); pending.resolve(stale);
    expect(await result).toBe(false);
    expect(stale.dispose).toHaveBeenCalledTimes(1);
  });
});
