import { describe, it, expect } from 'vitest';
import { mergePrompt, createEmptyProject, newTextBox } from '../state';
import { Project, PlatformPreset } from '../types';

function buildProject(weights: Array<[string, number]>, preset: PlatformPreset): string {
  const project: Project = createEmptyProject('Test');
  // remove initial default boxes and replace
  project.boxes = weights.map(([content, weight], idx) => ({
    ...newTextBox('default'),
    id: `b${idx}`,
    content,
    weight,
  }));
  return mergePrompt(project, preset);
}

describe('mergePrompt', () => {
  it('joins parts with comma+space', () => {
    const out = buildProject([
      ['cat', 0],
      ['dog', 0],
      ['bird', 0],
    ], 'plain');
    expect(out).toBe('cat, dog, bird');
  });

  it('applies ::weight for midjourney/plain when weight > 0', () => {
    const out = buildProject([
      ['cat', 1.25],
      ['dog', 0],
    ], 'midjourney');
    expect(out).toBe('cat::1.3, dog'); // rounded to 1 decimal
  });

  it('applies (text:weight) for stable-diffusion', () => {
    const out = buildProject([
      ['castle', 0],
      ['mist', 2.0],
    ], 'stable-diffusion');
    expect(out).toBe('castle, (mist:2.0)');
  });

  it('ignores weights for dalle', () => {
    const out = buildProject([
      ['sunset', 3],
      ['mountain', 0],
    ], 'dalle');
    expect(out).toBe('sunset, mountain');
  });

  it('skips empty content', () => {
    const out = buildProject([
      ['', 2],
      ['visible', 1],
    ], 'plain');
    expect(out).toBe('visible::1.0');
  });
});
