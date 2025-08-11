import { describe, it, expect, beforeAll, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { PromptEditor } from '../components/PromptEditor';
import { createEmptyProject } from '../state';
import type { AppState } from '../state';

// Polyfills for jsdom environment
beforeAll(() => {
  // crypto.randomUUID
  if (!(global as any).crypto) (global as any).crypto = {} as any;
  if (!(global as any).crypto.randomUUID) (global as any).crypto.randomUUID = () => 'uuid-' + Math.random().toString(16).slice(2);
  // localStorage minimal
  if (!(global as any).localStorage) {
    const store: Record<string, string> = {};
    (global as any).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    };
  }
  // clipboard
  if (!(navigator as any).clipboard) {
    (navigator as any).clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
  }
});

function makeState(): AppState {
  const project = createEmptyProject('Test');
  return {
    projects: [project],
    activeProjectId: project.id,
    history: { past: [], future: [] },
    toasts: [],
    search: '',
    tagFilter: [],
    filterMode: 'AND',
    userPrefs: { pinnedTags: [] },
    lastFocusedBoxId: null,
    activePreset: 'plain',
  };
}

const Wrapper: React.FC = () => {
  const [state, setState] = React.useState<AppState>(() => makeState());
  return <PromptEditor state={state} setState={setState} />;
};

describe('PromptEditor integration', () => {
  it('renders initial text boxes and allows adding a box', () => {
    render(<Wrapper />);
    const heading = screen.getByText('Text Boxes');
    expect(heading).toBeTruthy();
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(4);
    const addSelect = screen.getByText('Add Text Box...').parentElement as HTMLSelectElement;
    fireEvent.change(addSelect, { target: { value: 'default' } });
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(5);
  });

  it('edits content and supports undo via ctrl+z', () => {
    render(<Wrapper />);
    const editors = screen.getAllByRole('textbox');
    const first = editors[0];
    fireEvent.focus(first);
    (first as HTMLElement).innerHTML = 'Hello';
    fireEvent.input(first);
    // Find copy button via aria-label accessible name
    const copyBtn = screen.getByRole('button', { name: /Copy All Text/i });
    expect(copyBtn).toBeTruthy();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect((first as HTMLElement).innerHTML === '' || (first as HTMLElement).textContent === '').toBe(true);
  });
});
