import { describe, it, expect } from 'vitest';
import { pushHistory, createEmptyProject, AppState } from '../state';

describe('pushHistory pruning', () => {
  it('prunes when exceeding count/size limits', () => {
    const p = createEmptyProject('Prune');
    const state = { projects:[p], activeProjectId: p.id, history:{ past:[], future:[] }, toasts:[], search:'', tagFilter:[], filterMode:'AND', userPrefs:{ pinnedTags:[] }, lastFocusedBoxId:null, activePreset:'plain' } as AppState;
    for (let i=0;i<305;i++) {
      p.boxes[0].content = 'data'+i;
      pushHistory(state);
    }
    expect(state.history.past.length).toBeLessThanOrEqual(300);
  });
});
