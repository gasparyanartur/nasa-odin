// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Loading and planning states from design/states.html. Byte counts and file names are loading chrome, not measured
// values: they sit in data-nonmetric elements.

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// null while the total is not known yet.
export function percent(loaded, total) {
  if (!(total > 0) || !Number.isFinite(loaded)) return null;
  return Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
}

// The file list keeps the order of first sight; the file before the current one is done.
export function trackFiles(files, name, maxRows = 6) {
  const out = files.map((f) => ({ ...f }));
  if (!name) return out;
  for (const f of out) if (f.name !== name && f.state === "loading") f.state = "done";
  const hit = out.find((f) => f.name === name);
  if (hit) hit.state = "loading";
  else out.push({ name, state: "loading" });
  return out.slice(-maxRows);
}

function make(doc, tag, cls, text) {
  const el = doc.createElement(tag);
  if (cls) el.setAttribute("class", cls);
  if (text !== undefined) el.textContent = text;
  return el;
}

const WORD = { done: "Done", loading: "Loading", waiting: "Waiting" };

export function createProgress(host, doc = globalThis.document, { title = "Loading the Gale boxwork scene", stage = "first view" } = {}) {
  const root = make(doc, "section", "plate progress");
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-labelledby", "progress-title");
  const label = make(doc, "h2", "plate__label", "Loading");
  const lead = make(doc, "p", "progress__lead", title);
  lead.setAttribute("id", "progress-title");
  const bar = make(doc, "div", "progress__bar");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Bytes loaded");
  bar.setAttribute("data-nonmetric", "");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("data-state", "waiting");
  const note = make(doc, "p", "plate__note", "");
  note.setAttribute("data-nonmetric", "");
  const list = make(doc, "div", "progress__files");
  list.setAttribute("data-nonmetric", "");
  root.append(label, lead, bar, note, list);
  host.appendChild(root);
  let files = [];

  const paintFiles = () => {
    list.replaceChildren(
      ...files.map((f) => {
        const row = make(doc, "div", "progress__file");
        row.setAttribute("data-state", f.state);
        row.append(make(doc, "span", "", f.name), make(doc, "span", "", ""), make(doc, "span", "", WORD[f.state] || ""));
        return row;
      }),
    );
  };

  return {
    el: root,
    update({ loaded, total, file: name }) {
      if (name) {
        files = trackFiles(files, name);
        paintFiles();
      }
      const pct = percent(loaded, total);
      if (pct === null) {
        bar.removeAttribute("aria-valuenow");
        bar.removeAttribute("aria-valuetext");
        bar.setAttribute("data-state", "waiting");
        note.textContent = `${formatBytes(loaded)} - ${stage}`;
        return;
      }
      bar.removeAttribute("data-state");
      bar.setAttribute("aria-valuenow", String(pct));
      bar.setAttribute("aria-valuetext", `${pct} percent`);
      bar.style.setProperty("--p", String(pct / 100));
      note.textContent = `${formatBytes(loaded)} of ${formatBytes(total)} - ${stage}`;
    },
    remove() {
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

// The planner at work: an indeterminate bar (the planner gives no partial progress) with what it checks.
export function planningPlate(doc = globalThis.document, { waiting = false } = {}) {
  const root = make(doc, "div", "plate planner-state");
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.append(
    make(doc, "h2", "plate__label", "Planner"),
    make(doc, "p", "plate__title", waiting ? "Waiting for the terrain" : "Planning the route"),
    make(
      doc,
      "p",
      "",
      waiting
        ? "The planner needs the slope grid of the walk area. It is on its way; the route follows as soon as it arrives."
        : "The planner checks the slope cap, the no-go zones and the distance from the crew rover for every step.",
    ),
  );
  const bar = make(doc, "div", "progress__bar progress__bar--busy");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", waiting ? "Waiting for the terrain" : "Planning the route");
  root.appendChild(bar);
  return root;
}
