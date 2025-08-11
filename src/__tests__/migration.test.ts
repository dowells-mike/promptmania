import { describe, it, expect } from 'vitest';
import { migrateProject, SCHEMA_VERSION } from '../state';

// simulate legacy v1 structure missing tags/weight/content defaults
const legacy = {
  id: 'p1',
  name: 'Legacy',
  created: Date.now(),
  modified: Date.now(),
  tags: [],
  version: 1,
  boxes: [
    { id: 'b1', type: 'text', category: 'subject', position: 1, created: 1, modified: 1 },
    { id: 'b2', type: 'image', category: 'reference', position: 2, created: 2, modified: 2 },
  ],
};

describe('migration', () => {
  it('adds missing fields and bumps version', () => {
    const migrated = migrateProject(legacy);
    expect(migrated.version).toBe(SCHEMA_VERSION);
    const t = migrated.boxes.find(b => b.id==='b1') as any;
    expect(Array.isArray(t.tags)).toBe(true);
    expect(typeof t.weight).toBe('number');
    expect(typeof t.content).toBe('string');
    const img = migrated.boxes.find(b => b.id==='b2') as any;
    expect(Array.isArray(img.tags)).toBe(true);
    expect(typeof img.content).toBe('string');
  });
});
