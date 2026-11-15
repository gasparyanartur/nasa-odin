/**
 * Files in public/ are named from the site root ("/boxwork/manifest.json"), in code and inside the bundled JSON.
 * A static host can serve the app below a folder (GitHub Pages: /<repo>/), so every such path gets Vite's base first.
 */
export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const root = base.endsWith('/') ? base : `${base}/`;
  if (root === '/' || path.startsWith(root)) return path;
  return root + path.slice(1);
}
