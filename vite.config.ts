import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:8100' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8100' } },
  plugins: [viteStaticCopy({ targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((dir) => ({
    src: `node_modules/cesium/Build/Cesium/${dir}`,
    dest: 'cesium',
    rename: { stripBase: 4 },
  })) })],
  define: { CESIUM_BASE_URL: JSON.stringify('/cesium/') },
});
