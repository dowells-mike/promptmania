import { Project, TextBox, ImageBox, BoxCategory, PlatformPreset } from './types';
import LZString from 'lz-string';

export interface AppState {
  projects: Project[];
  activeProjectId: string | null;
  history: { past: { data: string; active: string | null; size: number }[]; future: { data: string; active: string | null; size: number }[] };
  toasts: { id: string; message: string; ts: number }[];
  search: string;
  tagFilter: string[]; // active tag filters
  filterMode: 'AND' | 'OR'; // filter mode
  userPrefs: UserPrefs; // global user preferences
  lastFocusedBoxId: string | null; // track last focused box for quick tag add
  activePreset: PlatformPreset; // NEW: selected platform formatting preset
}

export interface UserPrefs {
  pinnedTags: string[];
}

const STORAGE_KEY = 'promptmania.projects.v1';
const PREFS_KEY = 'promptmania.userprefs.v1';

export function createEmptyProject(name = 'Untitled Project'): Project {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    created: now,
    modified: now,
    tags: [],
    version: 1,
    boxes: [
      newTextBox('subject'),
      newTextBox('style'),
      newTextBox('background'),
      newTextBox('composition'),
    ],
  };
}

export function newTextBox(category: BoxCategory = 'default'): TextBox {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    type: 'text',
    category,
    position: now,
    created: now,
    modified: now,
    content: '',
    richText: '',
    weight: 0,
    tags: [],
  };
}

export function newImageBox(): ImageBox {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    type: 'image',
    category: 'reference',
    position: now,
    created: now,
    modified: now,
    content: '',
    tags: [],
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const prefRaw = localStorage.getItem(PREFS_KEY);
    const prefs: UserPrefs = prefRaw ? JSON.parse(prefRaw) : { pinnedTags: [] };
    if (raw) {
      const parsed = JSON.parse(raw) as Project[];
      return {
        projects: parsed,
        activeProjectId: parsed[0]?.id ?? null,
        history: { past: [], future: [] },
        toasts: [],
        search: '',
        tagFilter: [],
        filterMode: 'AND',
        userPrefs: prefs,
        lastFocusedBoxId: null,
        activePreset: 'plain',
      };
    }
  } catch (e) {
    console.warn('Failed to load', e);
  }
  const p = createEmptyProject();
  return { projects: [p], activeProjectId: p.id, history: { past: [], future: [] }, toasts: [], search: '', tagFilter: [], filterMode: 'AND', userPrefs: { pinnedTags: [] }, lastFocusedBoxId: null, activePreset: 'plain' };
}

export function persistProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function persistUserPrefs(prefs: UserPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function mergePrompt(project: Project, preset: PlatformPreset = 'plain'): string {
  const textBoxes = project.boxes.filter(b => b.type === 'text') as TextBox[];
  const parts = textBoxes
    .filter(b => b.content.trim().length)
    .map(b => {
      const base = b.content.trim();
      if (b.weight && b.weight > 0) {
        if (preset === 'midjourney' || preset === 'plain') return `${base}::${b.weight.toFixed(1)}`;
        if (preset === 'stable-diffusion') return `(${base}:${b.weight.toFixed(1)})`;
        if (preset === 'dalle') return base; // DALL-E normally ignores weights
      }
      return base;
    });
  return parts.join(', ');
}

export function addToast(state: AppState, message: string) {
  state.toasts.push({ id: crypto.randomUUID(), message, ts: Date.now() });
}

export function snapshotProjects(projects: Project[]): Project[] {
  return projects.map(p => ({ ...p, boxes: p.boxes.map(b => ({ ...b })) }));
}

export function compressProjects(projects: Project[], active: string | null): { data: string; active: string | null; size: number } {
  const raw = JSON.stringify(projects);
  const compressed = LZString.compressToUTF16(raw);
  return { data: compressed, active, size: compressed.length };
}

export function decompressProjects(data: string): Project[] {
  const decompressed = LZString.decompressFromUTF16(data) || '[]';
  const parsed = JSON.parse(decompressed) as Project[];
  return parsed.map(p => ({ ...p, boxes: p.boxes.map(b => ({ ...b })) }));
}

export function pushHistory(state: AppState) {
  try {
    state.history.past.push(compressProjects(state.projects, state.activeProjectId));
    let total = state.history.past.reduce((a, e) => a + e.size, 0);
    while (total > 2_000_000 && state.history.past.length > 1) {
      const removed = state.history.past.shift();
      total -= removed ? removed.size : 0;
    }
    if (state.history.past.length > 300) state.history.past.shift();
    state.history.future = [];
  } catch (e) { console.warn('pushHistory failed', e); }
}

export function restoreSnapshot(entry: { data: string }) : Project[] {
  return decompressProjects(entry.data);
}
