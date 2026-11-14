// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import { planRoute, planReturn } from "./planner.js";

// The payload carries plain objects and typed arrays (pass the buffers as transferables), not a Terrain instance.
export function handleMessage(data) {
  const { type, id, payload } = data;
  try {
    if (type === "plan") return { id, result: planRoute(payload) };
    if (type === "return") return { id, result: planReturn(payload) };
    return { id, error: `unknown message type: ${type}` };
  } catch (err) {
    return { id, error: String(err && err.message ? err.message : err) };
  }
}

if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof window === "undefined") {
  self.onmessage = (event) => self.postMessage(handleMessage(event.data));
}
