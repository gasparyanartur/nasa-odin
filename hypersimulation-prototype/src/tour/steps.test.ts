import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { anchorsOf, wordCount } from './engine';
import { RECOVER, STEPS } from './steps';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.ts$/.test(name) && !path.includes(join('src', 'tour')) ? [readFileSync(path, 'utf8')] : [];
  });
}

const doc = readFileSync('docs/tour-anchors.md', 'utf8');
const code = sources('src').join('\n');
const inDoc = (name: string) => doc.includes(`\`${name}\``);
const inCode = (name: string) => code.includes(`data-tour="${name}"`) || code.includes(`tour="${name}"`);

describe('tour steps', () => {
  const names = [...new Set([...STEPS.flatMap(anchorsOf), ...Object.values(RECOVER).flat()])];

  it.each(names)('anchor %s exists in docs/tour-anchors.md or in the source', name => {
    expect(inDoc(name) || inCode(name)).toBe(true);
  });

  it('has 12 to 16 steps over the three places, Station first, the closing card last', () => {
    expect(STEPS.length).toBeGreaterThanOrEqual(12);
    expect(STEPS.length).toBeLessThanOrEqual(16);
    expect(STEPS[0].chapter).toBe('Station');
    expect(new Set(STEPS.map(s => s.chapter))).toEqual(new Set(['Station', 'Tablet', 'Helmet']));
    expect(STEPS.at(-1)!.final).toBe(true);
    expect(STEPS.filter(s => s.final)).toHaveLength(1);
    expect(new Set(STEPS.map(s => s.id)).size).toBe(STEPS.length);
  });

  it.each(STEPS.map(s => [s.id, s] as const))('step %s: one short plain sentence, no em-dash', (_id, s) => {
    for (const text of [s.caption, s.doIt]) {
      expect(wordCount(text)).toBeLessThanOrEqual(14);
      expect(text).not.toMatch(new RegExp(String.fromCharCode(0x2014)));
    }
  });

  it('never triggers a hazard, a walk or pointer lock by itself', () => {
    const clicked = STEPS.filter(s => s.action === 'click').flatMap(s => [s.target, ...(s.via ?? [])]);
    for (const banned of ['trigger-event', 'walk-route', 'enter-surface', 'explore-freely', 'hud-tab', 'return-to-surface', 'display-return']) expect(clicked).not.toContain(banned);
    expect(STEPS.filter(s => s.chapter === 'Helmet').every(s => s.pointer === false)).toBe(true);
  });
});
