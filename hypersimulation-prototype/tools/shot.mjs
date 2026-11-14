// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Screenshot or PDF of one app URL through a headless Chrome that is already running with --remote-debugging-port=9333.
// It waits until the route is planned. PORT is the app port (default 8771).
// usage: node cdp.mjs <url> <w> <h> <out.png|-> [script.js]  (script body is evaluated as an async function; its return is printed)
import { readFileSync, writeFileSync } from "node:fs";
const [url, w, h, out, script] = process.argv.slice(2);
const mobile = Number(w) < 600;
const tgt = await (await fetch("http://127.0.0.1:9333/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === "Runtime.exceptionThrown") logs.push("EXC " + JSON.stringify(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text).slice(0, 300));
  if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) logs.push(msg.params.type + " " + msg.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") logs.push("LOG " + msg.params.entry.text.slice(0, 200) + " " + (msg.params.entry.url || ""));
  if (msg.method === "Network.requestWillBeSent") { const u = msg.params.request.url; if (!u.startsWith("http://127.0.0.1:" + (process.env.PORT || "8771")) && !u.startsWith("data:") && !u.startsWith("blob:")) logs.push("FOREIGN " + u); }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable"); await send("Log.enable"); await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile });
if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
await send("Page.enable");
await send("Page.navigate", { url });
const evalJs = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  return r.result.exceptionDetails ? "EVAL-ERR " + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text) : r.result.result.value;
};
const t0 = Date.now();
for (;;) {
  const ok = await evalJs("!!(window.__marswalk && window.__marswalk.state().plan && ['ok','no_route'].includes(window.__marswalk.state().plan.status))");
  if (ok === true || Date.now() - t0 > Number(process.env.WAITMS || 60000)) break;
  await new Promise((r) => setTimeout(r, 300));
}
await new Promise((r) => setTimeout(r, 1500));
if (script) {
  const body = readFileSync(script, "utf8");
  const res = await evalJs(`(async () => { ${body} })()`);
  console.log(typeof res === "string" ? res : JSON.stringify(res));
}
await new Promise((r) => setTimeout(r, 600));
if (out.endsWith(".pdf")) {
  const p = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
  writeFileSync(out, Buffer.from(p.result.data, "base64"));
} else if (out !== "-") {
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(s.result.data, "base64"));
}
console.log("LOGS", JSON.stringify(logs));
await send("Target.closeTarget", { targetId: tgt.id }).catch(() => {});
ws.close();
await fetch(`http://127.0.0.1:9333/json/close/${tgt.id}`).catch(() => {});
process.exit(0);
