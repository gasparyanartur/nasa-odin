export interface LayerHandle {
  setVisible(visible: boolean): void;
  setOpacity(opacity: number): void;
  dispose(): void;
}

// Independent of React and Cesium; a future adapter implements the same handle.
export class LayerSlot<T> {
  private generation = 0;
  private current?: LayerHandle;
  private visible = true;
  private opacity = 1;
  private disposed = false;

  constructor(private create: (definition: T) => Promise<LayerHandle>) {}

  async replace(definition: T): Promise<boolean> {
    if (this.disposed) return false;
    const generation = ++this.generation;
    const layer = await this.create(definition);
    if (this.disposed || generation !== this.generation) { layer.dispose(); return false; }
    layer.setVisible(this.visible);
    layer.setOpacity(this.opacity);
    this.current?.dispose();
    this.current = layer;
    return true;
  }

  invalidatePending() { this.generation++; }
  setVisible(value: boolean) { this.visible = value; this.current?.setVisible(value); }
  setOpacity(value: number) { this.opacity = Math.max(0, Math.min(1, value)); this.current?.setOpacity(this.opacity); }
  dispose() { this.disposed = true; this.generation++; this.current?.dispose(); this.current = undefined; }
}
