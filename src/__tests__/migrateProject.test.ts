import { describe, it, expect } from 'vitest';
import { migrateProject, SCHEMA_VERSION } from '../state';
import { TextBox, ImageBox } from '../types';

// Minimal legacy v1 shapes without newer fields
interface LegacyBox { id: string; type: 'text' | 'image'; category: string }
interface LegacyProject { id: string; name: string; created: number; modified: number; version: number; tags: string[]; boxes: LegacyBox[] }

describe('migrateProject', () => {
  it('fills defaults for legacy v1 text and image boxes', () => {
    const legacy: LegacyProject = {
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
    const t = migrated.boxes.find(b => b.type==='text') as TextBox | undefined;
    const i = migrated.boxes.find(b => b.type==='image') as ImageBox | undefined;
    expect(typeof t?.weight).toBe('number');
    expect(typeof t?.content).toBe('string');
    expect(Array.isArray(t?.tags)).toBe(true);
    expect(Array.isArray(i?.tags)).toBe(true);
  });
});
