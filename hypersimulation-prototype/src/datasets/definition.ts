export interface DatasetDefinition {
  id: string;
  name: string;
  description: string;
  source: string;
  sourceUrl: string;
  attribution: string;
  resolution: string;
  reference: 'EPSG:104905';
  bounds: [number, number, number, number];
  legend?: string;
  dataKind?: 'observation' | 'derived' | 'unknown';
  acquisitionNote?: string;
  provider: {
    type: 'wmts';
    url: string;
    layer: string;
    style: string;
    format: 'image/jpeg' | 'image/png';
    tileMatrixSetID: string;
    tileMatrixLabels: string[];
    tileWidth: number;
    tileHeight: number;
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object.');
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing or invalid ${field}.`);
  return value;
}

function url(value: unknown, field: string): string {
  const result = text(value, field);
  let parsed: URL;
  try { parsed = new URL(result); } catch { throw new Error(`${field} must be an absolute HTTP(S) URL.`); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error(`${field} must use HTTP(S).`);
  return result;
}

export function parseDataset(input: unknown): DatasetDefinition {
  const data = object(input);
  if (data.reference !== 'EPSG:104905') throw new Error('Unsupported reference. Use EPSG:104905: Mars geographic coordinates, east-positive longitude, −180° to 180°.');
  const bounds = data.bounds;
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every((v) => typeof v === 'number' && Number.isFinite(v))) throw new Error('bounds must contain west, south, east, north in degrees.');
  const [west, south, east, north] = bounds as number[];
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) throw new Error('Invalid bounds. Use increasing longitude in −180…180 and latitude in −90…90.');
  if(data.dataKind!==undefined&&!['observation','derived','unknown'].includes(String(data.dataKind)))throw new Error('dataKind must be observation, derived or unknown.');
  const p = object(data.provider);
  if (p.type !== 'wmts') throw new Error('Unsupported provider. This version supports WMTS imagery.');
  const template = url(p.url, 'provider.url');
  for (const token of ['{TileMatrix}', '{TileRow}', '{TileCol}']) if (!template.includes(token)) throw new Error(`provider.url must include ${token}.`);
  if (p.format !== 'image/jpeg' && p.format !== 'image/png') throw new Error('provider.format must be image/jpeg or image/png.');
  if (!Array.isArray(p.tileMatrixLabels) || !p.tileMatrixLabels.length || !p.tileMatrixLabels.every((v) => typeof v === 'string' && v.length)) throw new Error('Provide tileMatrixLabels in geographic zoom order, starting with the 2 × 1 tile level.');
  for (const field of ['tileWidth', 'tileHeight']) if (!Number.isInteger(p[field]) || Number(p[field]) < 1 || Number(p[field]) > 4096) throw new Error(`Invalid provider.${field}.`);
  return {
    id: text(data.id, 'id'), name: text(data.name, 'name'), description: text(data.description, 'description'),
    source: text(data.source, 'source'), sourceUrl: url(data.sourceUrl, 'sourceUrl'), attribution: text(data.attribution, 'attribution'),
    resolution: text(data.resolution, 'resolution'), reference: 'EPSG:104905', bounds: bounds as DatasetDefinition['bounds'],
    legend: data.legend === undefined ? undefined : text(data.legend, 'legend'),
    dataKind: data.dataKind as DatasetDefinition['dataKind'],
    acquisitionNote: data.acquisitionNote===undefined?undefined:text(data.acquisitionNote,'acquisitionNote'),
    provider: {
      type: 'wmts', url: template, layer: text(p.layer, 'provider.layer'), style: text(p.style, 'provider.style'),
      format: p.format, tileMatrixSetID: text(p.tileMatrixSetID, 'provider.tileMatrixSetID'),
      tileMatrixLabels: [...p.tileMatrixLabels] as string[], tileWidth: p.tileWidth as number, tileHeight: p.tileHeight as number,
    },
  };
}
