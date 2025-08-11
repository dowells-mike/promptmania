import { describe, it, expect } from 'vitest';

// We'll re-implement the hash logic inline if not exported; adapt when utility extracted
function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 60% 45%)`;
}

describe('tagColor hashing', () => {
  it('is deterministic for same tag', () => {
    expect(tagColor('test')).toBe(tagColor('test'));
  });
  it('produces varied hues', () => {
    const hues = new Set(['alpha','beta','gamma','delta','epsilon','zeta','eta','theta'].map(t => tagColor(t)));
    expect(hues.size).toBeGreaterThan(5);
  });
});
