// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Keeps the keyboard focus in place when a panel rebuilds its content: the element that held it is found again by
// its data-focus-key, else by its place among the focusable elements of the container.
const FOCUSABLE = "button, [tabindex], a[href], input, select, textarea";

function focusables(root) {
  return typeof root.querySelectorAll === "function" ? [...root.querySelectorAll(FOCUSABLE)] : [];
}

export function keepFocus(root, rebuild, doc = root.ownerDocument || globalThis.document) {
  const active = doc ? doc.activeElement : null;
  const inside = !!(active && active !== root && typeof root.contains === "function" && root.contains(active));
  const key = inside && active.getAttribute ? active.getAttribute("data-focus-key") : null;
  const index = inside ? focusables(root).indexOf(active) : -1;
  rebuild();
  if (!inside || (typeof root.contains === "function" && root.contains(doc.activeElement))) return;
  const all = focusables(root);
  const target = (key !== null && all.find((e) => e.getAttribute && e.getAttribute("data-focus-key") === key)) || (index >= 0 ? all[Math.min(index, all.length - 1)] : null);
  if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
}
