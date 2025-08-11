import { describe, it, expect } from 'vitest';
import { migrateProject, SCHEMA_VERSION } from '../state';

describe('migrateProject', () => {
  it('fills defaults for legacy v1 text and image boxes', () => {
    const legacy: any = {
      id: 'p1',
      name: 'Legacy',
      created: Date.now(),
      modified: Date.now(),
      version: 1,
      tags: ['foo'],
      boxes: [
        { id: 't1', type: 'text', category: 'subject' },
        { id: 'i1', type: 'image', category: 'reference' }
      ]
    };
    const migrated = migrateProject(legacy);
    expect(migrated.version).toBe(SCHEMA_VERSION);
    const t = migrated.boxes.find(b => b.type==='text');
    const i = migrated.boxes.find(b => b.type==='image');
    expect(t && typeof (t as any).weight).toBe('number');
    expect(t && typeof (t as any).content).toBe('string');
    expect(Array.isArray((t as any).tags)).toBe(true);
    expect(Array.isArray((i as any).tags)).toBe(true);
  });
});
