import { describe, expect, it } from 'vitest';
import mola from '../../public/datasets/mola.json';
import { parseDataset } from './definition';

describe('dataset definitions', () => {
  it('accepts the shipped real dataset without renderer-specific objects', () => {
    expect(parseDataset(mola).provider.tileMatrixLabels).toHaveLength(8);
    expect(parseDataset(mola).reference).toBe('EPSG:104905');
    expect(parseDataset(mola).dataKind).toBe('derived');
    expect(parseDataset(mola).acquisitionNote).toContain('per-pixel');
  });
  it.each([
    [null, 'JSON object'],
    [{...mola,dataKind:'forecast'},'dataKind'],
    [{ ...mola, reference: 'EPSG:4326' }, 'Unsupported reference'],
    [{ ...mola, bounds: [170, -10, -170, 10] }, 'Invalid bounds'],
    [{ ...mola, bounds: [-180, -91, 180, 90] }, 'Invalid bounds'],
    [{ ...mola, sourceUrl: 'javascript:alert(1)' }, 'HTTP(S)'],
    [{ ...mola, provider: { ...mola.provider, type: 'raw-tiff' } }, 'Unsupported provider'],
    [{ ...mola, provider: { ...mola.provider, url: 'https://example.org/tile.jpg' } }, 'TileMatrix'],
    [{ ...mola, provider: { ...mola.provider, tileWidth: 0 } }, 'tileWidth'],
    [{ ...mola, provider: { ...mola.provider, tileMatrixLabels: [] } }, 'tileMatrixLabels'],
  ])('rejects unusable definitions with a useful error', (input, message) => {
    expect(() => parseDataset(input)).toThrow(message as string);
  });
});
