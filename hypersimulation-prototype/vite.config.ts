import { existsSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// This folder runs beside the root app: planner default 8101, and Cesium from the root node_modules when none is installed here.
const modules = existsSync('node_modules/cesium') ? 'node_modules' : '../node_modules';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
  server: { port: 5174, proxy: { '/api': `http://127.0.0.1:${env.API_PORT??'8101'}` } },
  preview: { port: 4174, proxy: { '/api': `http://127.0.0.1:${env.API_PORT??'8101'}` } },
  plugins: [viteStaticCopy({ targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((dir) => ({
    src: `${modules}/cesium/Build/Cesium/${dir}`,
    dest: 'cesium',
    rename: { stripBase: 4 },
  })) })],
  define: { CESIUM_BASE_URL: JSON.stringify('/cesium/') },
  };
});
