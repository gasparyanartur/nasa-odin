import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// This folder runs beside the root app (5173, 4173), and takes Cesium from the root node_modules when none is installed here.
const modules = existsSync('node_modules/cesium') ? 'node_modules' : '../node_modules';
// A static host below a folder (GitHub Pages: VITE_BASE=/<repo>/) needs every asset, worker and Cesium file under it.
const trimmed = (process.env.VITE_BASE ?? '').trim().replace(/^\/+|\/+$/g, '');
const base = trimmed ? `/${trimmed}/` : '/';

export default defineConfig({
  base,
  server: { port: 5174 },
  preview: { port: 4174 },
  plugins: [viteStaticCopy({ targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((dir) => ({
    src: `${modules}/cesium/Build/Cesium/${dir}`,
    dest: 'cesium',
    rename: { stripBase: 4 },
  })) })],
  define: { CESIUM_BASE_URL: JSON.stringify(`${base}cesium/`) },
});
