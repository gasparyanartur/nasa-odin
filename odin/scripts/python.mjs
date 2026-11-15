// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Runs the data-preparation and reference-check Python: this folder's .venv when it exists, otherwise the repository root's .venv.
// Usage: node scripts/python.mjs <python arguments>
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const bin = process.platform === 'win32' ? join('Scripts', 'python.exe') : join('bin', 'python');

export function venvPython() {
  for (const venv of [join(here, '.venv'), join(here, '..', '.venv')]) {
    if (existsSync(join(venv, bin))) return join(venv, bin);
  }
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const python = venvPython();
  if (!python) { console.error('No Python environment found in odin/.venv or ../.venv; see README.'); process.exit(1); }
  const child = spawn(python, process.argv.slice(2), { stdio: 'inherit' });
  child.on('error', (e) => { console.error(e.message); process.exit(1); });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}
