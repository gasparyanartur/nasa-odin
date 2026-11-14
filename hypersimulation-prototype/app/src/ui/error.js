// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The error screen from design/states.html. Two kinds: a data error has {file, status, reason}; an input error
// has {field, problem}. Every fact is named; retry is the main action.

export function describeError(err) {
  if (err && typeof err === "object" && ("field" in err || "problem" in err)) {
    return { kind: "inputs", field: String(err.field ?? "(unknown)"), problem: String(err.problem ?? "") };
  }
  if (err && typeof err === "object" && "file" in err) {
    return { kind: "data", file: String(err.file), status: Number(err.status) || 0, reason: String(err.reason ?? "") };
  }
  return { kind: "data", file: "(app)", status: 0, reason: err && err.message ? String(err.message) : String(err) };
}

export function statusText(status) {
  return status > 0 ? `HTTP ${status}` : "No response";
}

const STATUS_WORDS = { 404: "not found on this host", 403: "refused by this host", 500: "error on the host", 503: "host not available" };

export function statusLine(status) {
  const w = STATUS_WORDS[status];
  return w ? `${statusText(status)} - ${w}` : statusText(status);
}

// What the file is for, so the title names the loss and not only the file.
const FILE_TITLES = [
  [/slope_core/, "The slope grid did not load", "Without it the planner cannot check the slope cap, so no route is drawn."],
  [/dem_core/, "The detailed terrain did not load", "Without it the walk area has no detailed heights."],
  [/dem_surround/, "The surround terrain did not load", "Nothing is drawn until this file arrives."],
  [/scene\.json/, "The scene description did not load", "It names every other file, so nothing is drawn until it arrives."],
  [/team-inputs/, "The walk inputs did not load", "The stations and walk values come from this file."],
  [/\.webp$/, "An image tile did not load", "The scene stays on the lower-detail image until this tile arrives."],
];

export function errorTitle(info) {
  if (info.kind === "inputs") return ["The walk inputs need a fix", "One field in the walk inputs is wrong. Fix the file and try again, or carry on with the committed inputs."];
  for (const [re, title, lead] of FILE_TITLES) if (re.test(info.file)) return [title, `${lead} Check the connection, then try again.`];
  return ["A data file did not load", "Nothing is drawn until this file arrives. Check the connection, then try again."];
}

// A field path of the walk inputs ("stations[2].x") in plain words ("station 3, east position"): the screen never
// shows the raw keys.
const FIELD_WORDS = {
  placeholder: "draft flag", signed_off_by: "signed off by", base: "crew rover", walking_speed_m_s: "walking speed",
  work_time_min_per_station: "work time per station", partner_trail_m: "partner spacing", hazard_start_min: "hazard start time",
  start_lmst_hour: "start hour", value: "value", on_path: "on the rover path", source_url: "source link",
  position_note: "position note", x: "east position", y: "north position", id: "number", kind: "ridge or hollow",
  position: "position", task: "task", photo: "photo", label: "name", name: "name", reported: "reported",
  stations: "stations", no_go: "no-go zones", drill_sites: "drill sites", polygon: "outline",
};
const LIST_WORDS = { stations: "station", no_go: "no-go zone", drill_sites: "drill site", polygon: "corner" };
export function fieldWords(field) {
  const f = String(field ?? "");
  if (f === "(file)") return "the whole file";
  if (f === "(stored file)") return "the copy kept in this browser";
  if (f === "(defaults)") return "the committed inputs";
  return f.split(".").map((part) => {
    const m = part.match(/^([a-z_]+)\[(\d+)\]$/);
    if (m && LIST_WORDS[m[1]]) return `${LIST_WORDS[m[1]]} ${Number(m[2]) + 1}`;
    return FIELD_WORDS[part] || part.replace(/_/g, " ");
  }).join(", ");
}

function make(doc, tag, cls, text) {
  const el = doc.createElement(tag);
  if (cls) el.setAttribute("class", cls);
  if (text !== undefined) el.textContent = text;
  return el;
}

function row(doc, list, label, value) {
  list.append(make(doc, "dt", "", label), make(doc, "dd", "", value));
}

function button(doc, label, primary, onClick) {
  const b = make(doc, "button", primary ? "btn btn--primary" : "btn", label);
  b.setAttribute("type", "button");
  b.addEventListener("click", onClick);
  return b;
}

// onRetry runs after the screen closes. onContinue is offered for input errors only.
export function showError(host, err, { onRetry, onContinue, doc = globalThis.document } = {}) {
  const info = describeError(err);
  const [titleText, leadText] = errorTitle(info);
  const root = make(doc, "section", "plate error-screen");
  root.setAttribute("role", "alertdialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "error-title");
  root.setAttribute("aria-describedby", "error-lead");

  const label = make(doc, "h2", "plate__label", info.kind === "inputs" ? "Inputs" : "Error");
  const title = make(doc, "p", "plate__title", titleText);
  title.setAttribute("id", "error-title");
  const lead = make(doc, "p", "", leadText);
  lead.setAttribute("id", "error-lead");

  const list = make(doc, "dl", "error-screen__facts");
  list.setAttribute("data-nonmetric", "");
  if (info.kind === "inputs") {
    row(doc, list, "Field", fieldWords(info.field));
    row(doc, list, "Problem", info.problem);
  } else {
    row(doc, list, "File", info.file);
    row(doc, list, "Status", statusLine(info.status));
    if (info.reason) row(doc, list, "Reason", info.reason);
  }

  const actions = make(doc, "div", "btn-row");
  const close = () => {
    if (root.parentNode) root.parentNode.removeChild(root);
    host.removeAttribute("data-open");
  };
  const buttons = [];
  if (info.kind === "inputs" && onContinue) {
    buttons.push(button(doc, "Continue with the committed inputs", true, () => {
      close();
      onContinue();
    }));
  }
  if (onRetry) {
    buttons.push(button(doc, info.kind === "inputs" ? "Try the file again" : "Retry the download", info.kind !== "inputs", () => {
      close();
      onRetry();
    }));
  }
  actions.append(...buttons);
  root.append(label, title, lead, list, actions);
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const active = doc.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  });
  host.appendChild(root);
  host.setAttribute("data-open", "");
  if (buttons[0]) buttons[0].focus();
  return { el: root, close };
}
