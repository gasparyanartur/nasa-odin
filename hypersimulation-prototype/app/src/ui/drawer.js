// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The Details drawer: every detail panel as a tab (state.panel), right side on a desktop, a bottom sheet at 390 px.
// Closed by default (state.drawer). A closed drawer leaves the page entirely, so none of its controls sits in the tab
// order or in the count of visible controls; the panels keep their content and keep updating while it is away.
// Inside the drawer every origin label shows in words (app.css). The map key sits at the foot of the Limits tab.
import { buildMapKey, inlineHatches } from "./legend.js";

export const TABS = [
  ["limits", "Limits"],
  ["timeline", "Timeline"],
  ["layers", "Layers"],
  ["stations", "Stations"],
  ["editor", "Editor"],
  ["rover", "Rover check"],
  ["credits", "Credits"],
];

// Roving focus over the tabs: arrows wrap, Home and End jump.
export function nextTab(current, key) {
  const ids = TABS.map((t) => t[0]);
  const i = Math.max(0, ids.indexOf(current));
  if (key === "ArrowRight" || key === "ArrowDown") return ids[(i + 1) % ids.length];
  if (key === "ArrowLeft" || key === "ArrowUp") return ids[(i - 1 + ids.length) % ids.length];
  if (key === "Home") return ids[0];
  if (key === "End") return ids[ids.length - 1];
  return null;
}

function el(doc, tag, cls, ...kids) {
  const e = doc.createElement(tag);
  if (cls) e.setAttribute("class", cls);
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

export function mount(ctx) {
  const drawer = ctx.regions.drawer || ctx.regions.dock;
  const doc = drawer.ownerDocument || globalThis.document;
  const { store, actions } = ctx;
  const home = drawer.parentNode;
  const anchor = drawer.nextSibling;

  const title = el(doc, "h2", "drawer__title", "Details");
  title.setAttribute("id", "drawer-title");
  const close = el(doc, "button", "btn drawer__close", "Close");
  close.setAttribute("type", "button");
  close.setAttribute("aria-label", "Close Details");
  close.addEventListener("click", () => {
    actions.setDrawer(false);
    const back = doc.getElementById("story-details");
    if (back && typeof back.focus === "function") back.focus();
  });
  const head = el(doc, "div", "drawer__head", title, close);
  drawer.setAttribute("aria-labelledby", "drawer-title");
  // Map tags keep clear of the open drawer.
  drawer.setAttribute("data-label-avoid", "");

  const list = el(doc, "div", "tabs drawer__tabs");
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", "Details panels");
  const tabs = new Map();
  const panels = new Map();
  for (const [id, label] of TABS) {
    const b = el(doc, "button", "tabs__tab", label);
    b.setAttribute("type", "button");
    b.setAttribute("role", "tab");
    b.setAttribute("id", `tab-${id}`);
    b.setAttribute("aria-controls", `panel-${id}`);
    b.addEventListener("click", () => actions.setPanel(id));
    b.addEventListener("keydown", (e) => {
      const to = nextTab(id, e.key);
      if (!to) return;
      e.preventDefault();
      actions.setPanel(to);
      tabs.get(to).focus();
    });
    list.appendChild(b);
    tabs.set(id, b);
    let p = drawer.querySelector(`#panel-${id}`);
    if (!p) {
      p = el(doc, "section", "drawer__panel");
      p.setAttribute("id", `panel-${id}`);
      p.setAttribute("role", "tabpanel");
      p.setAttribute("aria-labelledby", `tab-${id}`);
      drawer.appendChild(p);
    }
    panels.set(id, p);
  }
  const body = el(doc, "div", "drawer__body", ...panels.values());
  drawer.replaceChildren(head, list, body);

  const legend = buildMapKey(doc);
  panels.get("limits").appendChild(legend);
  inlineHatches(doc);

  let shown = null;
  let open = null;
  const apply = (s) => {
    const want = !!s.drawer;
    if (want !== open) {
      open = want;
      if (want && !drawer.parentNode && home) home.insertBefore(drawer, anchor && anchor.parentNode === home ? anchor : null);
      else if (!want && drawer.parentNode) drawer.remove();
    }
    const tab = TABS.some((t) => t[0] === s.panel) ? s.panel : "limits";
    if (tab === shown) return;
    shown = tab;
    for (const [id, b] of tabs) {
      const on = id === tab;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.setAttribute("tabindex", on ? "0" : "-1");
      const p = panels.get(id);
      if (on) p.setAttribute("data-active", "");
      else p.removeAttribute("data-active");
    }
    body.scrollTop = 0;
  };
  apply(store.getState());
  const off = store.subscribe(apply);
  return () => {
    off();
    legend.remove();
    if (!drawer.parentNode && home) home.insertBefore(drawer, anchor && anchor.parentNode === home ? anchor : null);
  };
}
