import { describe, it, expect } from 'vitest';
import { pushHistory, createEmptyProject, compressProjects, decompressProjects, AppState } from '../state';

describe('history compression', () => {
  it('pushHistory stores compressed data smaller or equal to raw JSON length', () => {
    const p = createEmptyProject('Hist');
    // add some size
    for (let i=0;i<20;i++) {
      p.boxes.push({ ...p.boxes[0], id: 'x'+i, content: 'lorem ipsum '.repeat(10), position: Date.now()+i });
    }
    const state = { projects: [p], activeProjectId: p.id, history: { past: [], future: [] } } as unknown as AppState;
    pushHistory(state);
    expect(state.history.past.length).toBe(1);
    const entry = state.history.past[0];
    const raw = JSON.stringify(state.projects);
    expect(entry.data.length).toBeLessThanOrEqual(raw.length); // compression might not always reduce UTF16 length, but shouldn't exceed raw JSON badly
  });

  it('restoreSnapshot round-trips project data', () => {
    const p = createEmptyProject('Round');
    p.boxes[0].content = 'Hello world';
    const snap = compressProjects([p], p.id);
    const restored = decompressProjects(snap.data);
    expect(restored[0].boxes[0].content).toBe('Hello world');
  });
});
