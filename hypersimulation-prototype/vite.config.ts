import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// This folder runs beside the root app (5173, 4173), and takes Cesium from the root node_modules when none is installed here.
const modules = existsSync('node_modules/cesium') ? 'node_modules' : '../node_modules';

export default defineConfig({
  server: { port: 5174 },
  preview: { port: 4174 },
  plugins: [viteStaticCopy({ targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((dir) => ({
    src: `${modules}/cesium/Build/Cesium/${dir}`,
    dest: 'cesium',
    rename: { stripBase: 4 },
  })) })],
  define: { CESIUM_BASE_URL: JSON.stringify('/cesium/') },
});
