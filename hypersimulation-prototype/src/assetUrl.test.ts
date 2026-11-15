import { describe, expect, it } from 'vitest';
import { withBase } from './assetUrl';

describe('site base for public files', () => {
  it('leaves paths alone at the site root', () => {
    expect(withBase('/boxwork', '/')).toBe('/boxwork');
    expect(withBase('/marswalk/pia26559_1024.webp')).toBe('/marswalk/pia26559_1024.webp');
  });
  it('puts a sub-path base in front of a root path once', () => {
    expect(withBase('/boxwork', '/nasa-martian-map/')).toBe('/nasa-martian-map/boxwork');
    expect(withBase('/boxwork/detail', '/nasa-martian-map')).toBe('/nasa-martian-map/boxwork/detail');
    expect(withBase('/nasa-martian-map/boxwork', '/nasa-martian-map/')).toBe('/nasa-martian-map/boxwork');
  });
  it('never touches full, protocol-relative or relative addresses', () => {
    for (const url of ['https://trek.nasa.gov/tiles/x.jpg', '//cdn.example/x', 'boxwork/x.json', 'data:image/png;base64,AA', '?demo=boxwork'])
      expect(withBase(url, '/nasa-martian-map/')).toBe(url);
  });
});
