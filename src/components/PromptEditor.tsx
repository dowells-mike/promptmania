import React, { useEffect, useMemo, useState } from 'react';
import { AppState, addToast, createEmptyProject, mergePrompt, newImageBox, newTextBox, persistProjects, persistUserPrefs, pushHistory, restoreSnapshot, compressProjects } from '../state';
import { AnyBox, Project, TextBox, ImageBox, PlatformPreset, isBoxCategory, isTextBox, isImageBox } from '../types';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import JSZip from 'jszip';

const DND_DESC_ID = 'dnd-instructions';

// Utility: deterministic tag color
function tagColor(tag: string): string { let hash = 0; for (let i=0;i<tag.length;i++) hash = (hash*31 + tag.charCodeAt(i))>>>0; const hues = [210,35,140,85,260,300,20,110]; return `hsl(${hues[hash % hues.length]}deg 70% 60%)`; }

// Reusable small icon button
const IconButton: React.FC<{ icon: string; onClick?: (e: React.MouseEvent) => void; tip?: string; ariaLabel?: string; className?: string; children?: React.ReactNode; }> = ({ icon, onClick, tip, ariaLabel, className='', children }) => (
  <button type="button" aria-label={ariaLabel || tip || icon} data-tip={tip} onClick={onClick} className={['icon-btn', className].filter(Boolean).join(' ')}>
    <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>{children}
  </button>
);

// Tag editor (box & project)
function TagEditor({ tags = [], onAdd, onRemove, inputRef }: { tags: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void; inputRef?: React.RefObject<HTMLInputElement>; }) {
  const [value, setValue] = useState('');
  const submit = () => { const t = value.trim().toLowerCase(); if (t && !tags.includes(t)) { onAdd(t); setValue(''); } };
  const removeLast = () => { if (!value && tags.length) onRemove(tags[tags.length-1]); };
  return (
    <div className="tag-editor" role="group" aria-label="Tags">
      <ul className="tag-list" style={{ listStyle:'none', padding:0, margin:0 }}>
        {tags.map(t => (
          <li key={t}>
            <span tabIndex={0} className="tag-chip" style={{ color: tagColor(t) }} onKeyDown={e => { if (e.key==='Delete' || e.key==='Backspace') { e.preventDefault(); onRemove(t); } }}>
              {t}<button aria-label={`Remove tag ${t}`} onClick={() => onRemove(t)}>×</button>
            </span>
          </li>
        ))}
      </ul>
      <div className="tag-add">
        <input ref={inputRef} placeholder="add tag" aria-label="Add tag" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); submit(); } else if (e.key==='Backspace') removeLast(); }} />
        <button className="icon-btn" data-tip="Add Tag" aria-label="Add tag" onClick={submit}><span className="material-symbols-rounded">add</span></button>
      </div>
    </div>
  );
}

// Rich text editor
function RichTextEditor({ value, onChange, onFocus, boxId }: { value: string; onChange: (html: string, plain: string) => void; onFocus?: () => void; boxId?: string; }) {
  const ref = React.useRef<HTMLDivElement|null>(null);
  const [color, setColor] = useState<string>('#ffffff');
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || ''; }, [value]);
  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); ref.current && onChange(ref.current.innerHTML, ref.current.innerText); };
  const handleInput = () => { if (!ref.current) return; onChange(ref.current.innerHTML, ref.current.innerText); };
  const toggleInlineCode = () => {
    const sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return; const range = sel.getRangeAt(0); if (range.collapsed) return;
    let node: Node | null = sel.anchorNode;
    while (node && node !== ref.current) { if ((node as HTMLElement).tagName === 'CODE') { const codeEl = node as HTMLElement; const text = codeEl.textContent || ''; codeEl.replaceWith(document.createTextNode(text)); handleInput(); return; } node = node.parentNode; }
    const wrapper = document.createElement('code'); wrapper.appendChild(range.extractContents()); range.insertNode(wrapper); sel.removeAllRanges(); const newRange = document.createRange(); newRange.selectNodeContents(wrapper); sel.addRange(newRange); handleInput();
  };
  const applyHeading = (level: string) => { if (level === 'p') exec('formatBlock', 'p'); else exec('formatBlock', `h${level}`); };
  const addLink = () => { let url = prompt('Enter URL'); if (!url) return; if (!/^https?:\/\//i.test(url)) url = 'https://' + url; exec('createLink', url); };
  const applyColor = (c: string) => { exec('foreColor', c); };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
        <select aria-label="Heading level" onChange={e => { const v=e.target.value; if(v){ applyHeading(v); e.target.value=''; } }} defaultValue="" style={{ background:'var(--bg-elev-3)', color:'inherit', border:'1px solid var(--border)', borderRadius:4, fontSize:'.6rem', padding:'0 .25rem', height:28 }}>
          <option value="" disabled>Hdr</option><option value="p">P</option><option value="2">H2</option><option value="3">H3</option>
        </select>
        <button type="button" className="icon-btn" data-tip="Bold" aria-label="Bold" onClick={() => exec('bold')}><span className="material-symbols-rounded">format_bold</span></button>
        <button type="button" className="icon-btn" data-tip="Italic" aria-label="Italic" onClick={() => exec('italic')}><span className="material-symbols-rounded">format_italic</span></button>
        <button type="button" className="icon-btn" data-tip="Underline" aria-label="Underline" onClick={() => exec('underline')}><span className="material-symbols-rounded">format_underlined</span></button>
        <button type="button" className="icon-btn" data-tip="Inline Code" aria-label="Inline code" onClick={toggleInlineCode}><span className="material-symbols-rounded">code</span></button>
        <button type="button" className="icon-btn" data-tip="Link" aria-label="Add link" onClick={addLink}><span className="material-symbols-rounded">link</span></button>
        <label className="icon-btn" data-tip="Color" aria-label="Text color" style={{ padding:0, overflow:'hidden' }}>
          <input type="color" value={color} onChange={e => { setColor(e.target.value); applyColor(e.target.value); }} style={{ width:'100%', height:'100%', opacity:0, cursor:'pointer' }} />
          <span className="material-symbols-rounded" style={{ color }} aria-hidden="true">palette</span>
        </label>
        <button type="button" className="icon-btn" data-tip="Clear Formatting" aria-label="Clear formatting" onClick={() => { document.execCommand('removeFormat'); handleInput(); }}><span className="material-symbols-rounded">format_clear</span></button>
      </div>
      <div ref={ref} data-box={boxId} className="rte" contentEditable suppressContentEditableWarning dir="ltr" role="textbox" aria-multiline="true" tabIndex={0} onFocus={onFocus} onInput={handleInput} style={{ minHeight:70, outline:'none' }} />
    </div>
  );
}

// Weight legend visual key
function WeightLegend() {
  return (
    <div className="weight-legend" aria-label="Weight legend">
      <div className="label-row"><span>0</span><span>Light</span><span>Medium</span><span>Heavy</span><span>5</span></div>
      <div className="bar" />
    </div>
  );
}

// Toast host
const ToastHost: React.FC<{ toasts: AppState['toasts']; setState: React.Dispatch<React.SetStateAction<AppState>>; }> = ({ toasts, setState }) => {
  useEffect(() => { const t = setInterval(() => { const now = Date.now(); setState(s => ({ ...s, toasts: s.toasts.filter(t => now - t.ts < 3000) })); }, 1000); return () => clearInterval(t); }, [setState]);
  return <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">{toasts.map(t => <div key={t.id} className="toast" role="status">{t.message}</div>)}</div>;
};

interface SortableBoxProps { box: TextBox; onChange: (mut: (b: TextBox) => void) => void; onDelete: () => void; onDuplicate: () => void; toast: (msg: string) => void; setState: React.Dispatch<React.SetStateAction<AppState>>; invalid?: boolean; onReorder: (delta: number) => void; }
const SortableBox: React.FC<SortableBoxProps> = ({ box, onChange, onDelete, onDuplicate, toast, setState, invalid, onReorder }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: box.id, data: { boxType: 'text' } });
  const style: React.CSSProperties & { ['--w']?: string } = { '--w': String((box.weight||0)/5), transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={['prompt-box', isDragging && 'dragging', invalid && 'invalid'].filter(Boolean).join(' ')} data-weight={box.weight} aria-invalid={invalid || undefined} aria-describedby={DND_DESC_ID}>
      <div className="prompt-box-header">
        <span className={'badge category-'+box.category}>{box.category}</span>
        <span className="drag-handle" aria-label="Reorder text box" onKeyDown={e => { if ((e.ctrlKey || e.altKey) && (e.key==='ArrowUp' || e.key==='ArrowDown')) { e.preventDefault(); onReorder(e.key==='ArrowUp' ? -1 : 1); toast('Box reordered'); } }} {...attributes} {...listeners}>⠿</span>
        <div className="weight-ctrl"><span className="material-symbols-rounded" style={{ fontSize:14, opacity:.6 }}>tune</span>
          <IconButton icon="remove" tip="Dec Weight" onClick={() => onChange(b => { b.weight = Math.max(0, +(b.weight - 0.1).toFixed(1)); })} />
          <input value={box.weight} onChange={e => { const v = Math.min(5, Math.max(0, parseFloat(e.target.value)||0)); onChange(b => { b.weight = parseFloat(v.toFixed(1)); }); }} />
          <IconButton icon="add" tip="Inc Weight" onClick={() => onChange(b => { b.weight = Math.min(5, +(b.weight + 0.1).toFixed(1)); })} />
        </div>
      </div>
      <RichTextEditor boxId={box.id} value={box.richText || box.content} onFocus={() => setState(s => ({ ...s, lastFocusedBoxId: box.id }))} onChange={(html, plain) => onChange(b => { b.richText = html; b.content = plain; })} />
      <div className="box-actions">
        <IconButton icon="content_copy" tip="Copy" onClick={() => { navigator.clipboard.writeText(box.content); toast('Text copied'); }} />
        <IconButton icon="backspace" tip="Clear" onClick={() => { onChange(b => { b.content=''; b.richText=''; }); toast('Cleared'); }} />
        <IconButton icon="control_point_duplicate" tip="Duplicate" onClick={onDuplicate} />
        <IconButton icon="delete" className="danger" tip="Delete" onClick={onDelete} />
      </div>
      <TagEditor tags={box.tags||[]} onAdd={t => onChange(b => { if(!b.tags.includes(t)) b.tags=[...b.tags,t]; })} onRemove={t => onChange(b => { b.tags = b.tags.filter(x => x!==t); })} />
      {invalid && <div style={{ fontSize:'.55rem', color:'#ff6b6b', letterSpacing:'.05em' }}>Subject is required</div>}
    </div>
  );
};

interface SortableImageBoxProps { box: ImageBox; onChange: (mut: (b: ImageBox) => void) => void; onDelete: () => void; onDuplicate: () => void; toast: (msg: string) => void; setState: React.Dispatch<React.SetStateAction<AppState>>; onReorder: (delta: number) => void; }
const SortableImageBox: React.FC<SortableImageBoxProps> = ({ box, onChange, onDelete, onDuplicate, toast, setState, onReorder }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: box.id, data: { boxType: 'image' } });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const onFile = async (file: File) => { const buf = await file.arrayBuffer(); const base64 = btoa(String.fromCharCode(...new Uint8Array(buf))); const dataUrl = `data:${file.type};base64,${base64}`; onChange(b => { b.content = dataUrl; b.filename = file.name; }); toast(`Image "${file.name}" uploaded`); };
  return (
    <div ref={setNodeRef} style={style} className={['prompt-box', isDragging && 'dragging'].filter(Boolean).join(' ')} aria-describedby={DND_DESC_ID}>
      <div className="prompt-box-header">
        <span className="badge category-reference">image</span>
        <span className="drag-handle" aria-label="Reorder image box" onKeyDown={e => { if ((e.ctrlKey || e.altKey) && (e.key==='ArrowUp' || e.key==='ArrowDown')) { e.preventDefault(); onReorder(e.key==='ArrowUp' ? -1 : 1); toast('Image reordered'); } }} {...attributes} {...listeners}>⠿</span>
      </div>
      <div className="image-ref">
        <label className="thumb">{box.content ? <img src={box.content} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <input type="file" aria-label="Upload image" onChange={e => { const f=e.target.files?.[0]; if(f) onFile(f);} } />}</label>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'.5rem' }}>
          <input className="inline-input" placeholder="Description" value={box.description||''} onFocus={() => setState(s => ({ ...s, lastFocusedBoxId: box.id }))} onChange={e => onChange(b => { b.description = e.target.value; })} />
          {box.filename && <div className="notice">{box.filename}</div>}
          <div className="box-actions">
            <IconButton icon="content_copy" tip="Copy Data URL" onClick={() => { navigator.clipboard.writeText(box.content); toast('Image data copied'); }} />
            <IconButton icon="backspace" tip="Clear" onClick={() => { onChange(b => { b.content=''; b.filename=''; }); toast('Image cleared'); }} />
            <IconButton icon="control_point_duplicate" tip="Duplicate" onClick={onDuplicate} />
            <IconButton icon="delete" className="danger" tip="Delete" onClick={onDelete} />
          </div>
          <TagEditor tags={box.tags||[]} onAdd={t => onChange(b => { const arr = b.tags || (b.tags=[]); if(!arr.includes(t)) b.tags=[...arr,t]; })} onRemove={t => onChange(b => { b.tags = (b.tags||[]).filter(x=>x!==t); })} />
        </div>
      </div>
    </div>
  );
};

// Main editor component
export const PromptEditor: React.FC<{ state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; }> = ({ state, setState }) => {
  const project = state.projects.find(p => p.id === state.activeProjectId)!;
  const userPrefs = state.userPrefs || { pinnedTags: [] };
  const [showPreview, setShowPreview] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const merged = useMemo(() => mergePrompt(project, state.activePreset || 'plain'), [project, state.activePreset]);
  const toast = (m: string) => { addToast(state, m); setState(s => ({ ...s })); };
  useEffect(() => { persistProjects(state.projects); }, [state.projects]);
  useEffect(() => { persistUserPrefs(state.userPrefs); }, [state.userPrefs]);
  const updateProject = (mut: (p: Project) => void) => { setState(s => { pushHistory(s); const projects = s.projects.map(p => p.id === project.id ? { ...p, boxes: p.boxes.map(b => ({ ...b })) } : p); const target = projects.find(p => p.id === project.id)!; mut(target); const texts = target.boxes.filter(isTextBox); const images = target.boxes.filter(isImageBox); target.boxes = [...texts, ...images]; target.modified = Date.now(); return { ...s, projects }; }); };
  const setBox = (id: string, mut: (b: AnyBox) => void) => updateProject(p => { const b = p.boxes.find(bx => bx.id === id); if (b) { mut(b); b.modified = Date.now(); } });
  const setTextBox = (id: string, mut: (b: TextBox) => void) => updateProject(p => { const b = p.boxes.find(bx => bx.id === id); if (b && b.type==='text') { mut(b); b.modified = Date.now(); } });
  const addText = (category: string) => { if (!isBoxCategory(category)) return; let newId: string | null = null; updateProject(p => { const b = newTextBox(category); newId = b.id; p.boxes.push(b); }); if (newId) setState(s => ({ ...s, lastFocusedBoxId: newId })); toast(`${category} box added`); };
  const addImage = () => { updateProject(p => { p.boxes.push(newImageBox()); }); toast('Image box added'); };
  const deleteBox = (id: string) => { updateProject(p => { p.boxes = p.boxes.filter(b => b.id !== id); }); toast('Box deleted'); };
  const duplicateBox = (id: string) => { updateProject(p => { const b = p.boxes.find(b => b.id === id); if (!b) return; const clone: AnyBox = { ...b, id: crypto.randomUUID(), created: Date.now(), modified: Date.now(), position: Date.now() }; p.boxes.push(clone); }); toast('Box duplicated'); };
  const clearAll = () => { updateProject(p => { p.boxes.forEach(b => { if (b.type === 'text') (b as TextBox).content=''; if (b.type === 'image') b.content=''; }); }); toast('All boxes cleared'); };
  const moveBox = (id: string, delta: number) => { updateProject(p => { const target = p.boxes.find(b => b.id === id); if(!target) return; const type = target.type; const group = p.boxes.filter(b => b.type === type); const ids = group.map(b => b.id); const idx = ids.indexOf(id); const newIdx = idx + delta; if(newIdx<0 || newIdx>=group.length) return; const reordered = arrayMove(group, idx, newIdx); const others = p.boxes.filter(b => b.type !== type); p.boxes = type === 'text' ? [...reordered, ...others] : [...others, ...reordered]; }); };
  const textBoxes: TextBox[] = project.boxes.filter(isTextBox);
  const imageBoxes: ImageBox[] = project.boxes.filter(isImageBox);
  const tagFreq = useMemo(() => { const f: Record<string, number> = {}; project.boxes.forEach(b => { if ('tags' in b && Array.isArray(b.tags)) { b.tags.forEach(t => { f[t] = (f[t] || 0) + 1; }); } }); return f; }, [project]);
  const allTags = useMemo(() => Object.keys(tagFreq).sort(), [tagFreq]);
  const paletteTags = useMemo(() => { const pinned = userPrefs.pinnedTags.map(t => ({ tag: t, count: tagFreq[t]||0, pinned:true })); const unpinned = allTags.filter(t => !userPrefs.pinnedTags.includes(t)).map(t => ({ tag:t, count: tagFreq[t]||0, pinned:false })); return [...pinned, ...unpinned]; }, [allTags, userPrefs.pinnedTags, tagFreq]);
  const toggleFilterTag = (t: string) => setState(s => ({ ...s, tagFilter: s.tagFilter.includes(t) ? s.tagFilter.filter(x => x!==t) : [...s.tagFilter, t] }));
  const switchMode = () => setState(s => ({ ...s, filterMode: s.filterMode === 'AND' ? 'OR' : 'AND' }));
  const togglePinned = (t: string) => { setState(s => ({ ...s, userPrefs: { ...(s.userPrefs||{ pinnedTags:[] }), pinnedTags: (s.userPrefs?.pinnedTags||[]).includes(t) ? (s.userPrefs?.pinnedTags||[]).filter(x => x!==t) : [...(s.userPrefs?.pinnedTags||[]), t] } })); toast((userPrefs.pinnedTags||[]).includes(t) ? `Unpinned '${t}'` : `Pinned '${t}'`); };
  const quickAddTag = (t: string) => { if (state.lastFocusedBoxId) { updateProject(p => { const b = p.boxes.find(bx => bx.id === state.lastFocusedBoxId); if (b && 'tags' in b) { if(!b.tags.includes(t)) b.tags=[...b.tags,t]; } }); toast(`Tag '${t}' added to box`); } else { updateProject(p => { if(!p.tags.includes(t)) p.tags.push(t); }); toast(`Tag '${t}' added to project`); } };
  const passesTagFilter = (tags: string[]) => { if (!state.tagFilter.length) return true; if (!tags) return false; return state.filterMode === 'AND' ? state.tagFilter.every(t => tags.includes(t)) : state.tagFilter.some(t => tags.includes(t)); };
  const filteredTextBoxes = useMemo(() => { let list = textBoxes; if (state.search) list = list.filter(b => b.content.toLowerCase().includes(state.search.toLowerCase())); if (state.tagFilter.length) list = list.filter(b => passesTagFilter(b.tags||[])); return list; }, [textBoxes, state.search, state.tagFilter, state.filterMode]);
  const filteredImageBoxes = useMemo(() => { let list = imageBoxes; if (state.tagFilter.length) list = list.filter(b => passesTagFilter(b.tags||[])); return list; }, [imageBoxes, state.tagFilter, state.filterMode]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const onDragEnd = (e: DragEndEvent) => { const { active, over } = e; setActiveId(null); if (!over || active.id === over.id) return; const aType = (active.data.current as { boxType: 'text'|'image' }).boxType; updateProject(p => { const group = p.boxes.filter(b => b.type === aType); const ids = group.map(b => b.id); const activeIndex = ids.indexOf(active.id as string); const overIndex = ids.indexOf(over.id as string); const newOrder = arrayMove(group, activeIndex, overIndex); const others = p.boxes.filter(b => b.type !== aType); p.boxes = aType === 'text' ? [...newOrder, ...others] : [...others, ...newOrder]; }); toast('Box order updated'); };
  const copyMerged = async () => { await navigator.clipboard.writeText(merged); toast('Complete prompt copied'); };
  const createProject = () => { const p = createEmptyProject(); setState(s => ({ ...s, projects: [p, ...s.projects], activeProjectId: p.id })); toast('New project created'); };
  const loadFile = async (file: File) => { const text = await file.text(); try { const parsed = JSON.parse(text); if (Array.isArray(parsed.boxes)) { setState(s => ({ ...s, projects: [parsed as Project, ...s.projects], activeProjectId: parsed.id })); toast(`Project "${parsed.name}" loaded`); } else toast('Invalid project file'); } catch { toast('Failed to load file'); } };
  const saveJson = () => { if(!project.name.trim()) { toast('Project name required'); return; } const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${project.name.replace(/\s+/g,'_')}.json`; a.click(); toast('Project saved'); };
  const exportByTag = () => { if (!state.tagFilter.length) { toast('Select tag filters first'); return; } const selected = state.tagFilter; const matches = project.boxes.filter(b => { if(!('tags' in b) || !b.tags.length) return false; return state.filterMode === 'AND' ? selected.every(t => b.tags.includes(t)) : selected.some(t => b.tags.includes(t)); }).filter((b): b is TextBox => b.type==='text'); if (!matches.length) { toast('No boxes match tags'); return; } const lines: string[] = []; selected.forEach(tag => { const group = matches.filter(b => b.tags.includes(tag)); if (!group.length) return; lines.push(`## ${tag}`); group.forEach(b => { const w = b.weight>0? ` (w:${b.weight.toFixed(1)})` : ''; lines.push(`- ${b.content.trim()}${w}`); }); lines.push(''); }); const md = `# ${project.name} (Tag Export)\n\n${lines.join('\n')}`; const blob = new Blob([md], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${project.name.replace(/\s+/g,'_')}_tags.md`; a.click(); toast('Tag export downloaded'); };
  const fullMarkdownExport = () => { const lines: string[] = []; lines.push(`# ${project.name}`); lines.push(`Created: ${new Date(project.created).toLocaleString()}`); lines.push(`Modified: ${new Date(project.modified).toLocaleString()}`); if(project.tags.length) lines.push(`Tags: ${project.tags.join(', ')}`); lines.push(''); if(textBoxes.length) { lines.push('## Text Segments'); textBoxes.forEach(b => { const tagStr = b.tags?.length ? ` [${b.tags.join(', ')}]` : ''; const weightStr = b.weight>0?` (w:${b.weight.toFixed(1)})`:''; lines.push(`- (${b.category})${weightStr}${tagStr}: ${b.content.trim()}`); }); lines.push(''); } if(imageBoxes.length){ lines.push('## Image References'); imageBoxes.forEach((b,i) => { const tagStr = b.tags?.length ? ` [${b.tags.join(', ')}]` : ''; lines.push(`- Image ${i+1}${tagStr}`); }); lines.push(''); } lines.push('## Merged Prompt'); lines.push('```'); lines.push(mergePrompt(project, state.activePreset)); lines.push('```'); const md = lines.join('\n'); const blob = new Blob([md], { type:'text/markdown' }); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${project.name.replace(/\s+/g,'_')}.md`; a.click(); toast('Markdown exported'); };
  const batchZipExport = async () => { const zip = new JSZip(); state.projects.forEach(p => { const md: string[] = []; md.push(`# ${p.name}`); if(p.tags.length) md.push(`Tags: ${p.tags.join(', ')}`); md.push(''); const texts = (p.boxes.filter(b=>b.type==='text') as TextBox[]); texts.forEach(b=>{ const w=b.weight>0?`::${b.weight.toFixed(1)}`:''; md.push(`- (${b.category}) ${b.content.trim()}${w}`); }); md.push(''); md.push('Merged:'); md.push(mergePrompt(p, p.id===project.id?state.activePreset:'plain')); zip.file(`${p.name.replace(/\s+/g,'_')}.md`, md.join('\n')); zip.file(`${p.name.replace(/\s+/g,'_')}.json`, JSON.stringify(p,null,2)); }); const blob = await zip.generateAsync({ type:'blob' }); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='projects_export.zip'; a.click(); toast('Batch zip exported'); };
  const deleteProject = (id: string) => { setState(s => { if (s.projects.length <= 1) { addToast(s, 'Cannot delete last project'); return { ...s }; } pushHistory(s); const remaining = s.projects.filter(p => p.id !== id); const activeProjectId = s.activeProjectId === id ? remaining[0].id : s.activeProjectId; addToast(s, 'Project deleted'); return { ...s, projects: remaining, activeProjectId }; }); };
  const undo = () => { setState(s => { const past = s.history.past; if (!past.length) { toast('Nothing to undo'); return { ...s }; } const last = past.pop()!; const snapshot = restoreSnapshot(last); s.history.future.push(compressProjects(s.projects, s.activeProjectId)); return { ...s, projects: snapshot, activeProjectId: last.active }; }); };
  const redo = () => { setState(s => { const fut = s.history.future; if (!fut.length) { toast('Nothing to redo'); return { ...s }; } const next = fut.pop()!; s.history.past.push(compressProjects(s.projects, s.activeProjectId)); const snapshot = restoreSnapshot(next); return { ...s, projects: snapshot, activeProjectId: next.active }; }); };
  const searchRef = React.useRef<HTMLInputElement|null>(null); const projectTagInputRef = React.useRef<HTMLInputElement|null>(null);
  useEffect(() => { const handler = (e: KeyboardEvent) => { const mod = e.metaKey || e.ctrlKey; if (!mod) return; if (e.key.toLowerCase() === 's') { e.preventDefault(); saveJson(); } else if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if ((e.key.toLowerCase() === 'y') || (e.key.toLowerCase()==='z' && e.shiftKey)) { e.preventDefault(); redo(); } else if (e.key.toLowerCase() === 'f') { e.preventDefault(); searchRef.current?.focus(); } else if (e.key.toLowerCase() === 't' && e.shiftKey) { e.preventDefault(); projectTagInputRef.current?.focus(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
  const metrics = useMemo(() => { const words = textBoxes.reduce((acc,b) => acc + b.content.trim().split(/\s+/).filter(Boolean).length, 0); const chars = textBoxes.reduce((a,b)=>a + b.content.length,0); const avgWeight = textBoxes.length ? (textBoxes.reduce((a,b)=>a+b.weight,0)/textBoxes.length) : 0; const tagCounts = Object.entries(tagFreq).sort((a,b)=>b[1]-a[1]); const estTokens = Math.round(chars/4); return { words, chars, estTokens, avgWeight, tagCounts }; }, [textBoxes, tagFreq]);
  return (
    <div className="app-shell">
      <div id={DND_DESC_ID} style={{ position:'absolute', width:1, height:1, padding:0, margin:-1, overflow:'hidden', clip:'rect(0 0 0 0)', whiteSpace:'nowrap', border:0 }}>
        Reorder instructions: Focus a drag handle then press Control or Alt plus Arrow Up or Arrow Down to move within its group. Text and image boxes reorder independently.
      </div>
      <div className="toolbar" role="banner">
        <h1>PromptMania</h1>
        <input aria-label="Project name" className="name" value={project.name} onChange={e => updateProject(p => { p.name = e.target.value; })} />
        <IconButton icon="save" tip="Save Project" onClick={saveJson} />
        <label className="icon-btn" data-tip="Load Project" aria-label="Load Project" style={{ position:'relative' }}>
          <span className="material-symbols-rounded">folder_open</span>
          <input style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }} type="file" onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
        </label>
        <IconButton icon="add_box" tip="New Project" onClick={createProject} />
        <div style={{ marginLeft:'auto', display:'flex', gap:'.5rem', alignItems:'center' }} className="search-bar">
          <input ref={searchRef} aria-label="Search text boxes" className="inline-input" placeholder="Search" value={state.search} onChange={e => setState(s => ({ ...s, search: e.target.value }))} />
          <IconButton icon="visibility" tip="Preview" onClick={() => setShowPreview(true)} />
          <IconButton icon="content_copy" tip="Copy All Text" onClick={copyMerged} />
          <IconButton icon="delete_sweep" tip="Clear All" onClick={clearAll} />
          <select aria-label="Export options" className="inline-input" style={{ width:150 }} onChange={e => { const v=e.target.value; if(!v) return; if(v==='json') saveJson(); else if(v==='md') fullMarkdownExport(); else if(v==='batch') batchZipExport(); else if(v==='tagmd') exportByTag(); e.target.value=''; }} defaultValue="">
            <option value="" disabled>Export...</option>
            <option value="json">Project JSON</option>
            <option value="md">Project Markdown</option>
            <option value="tagmd">Tagged Sections MD</option>
            <option value="batch">All Projects Zip</option>
          </select>
        </div>
        <select value={state.activePreset} onChange={e => { const v = e.target.value as PlatformPreset; setState(s => ({ ...s, activePreset: v })); }} className="inline-input" style={{ width:140 }}>
          <option value="plain">Plain</option>
          <option value="midjourney">Midjourney</option>
          <option value="stable-diffusion">Stable Diffusion</option>
          <option value="dalle">DALL-E</option>
        </select>
        <IconButton icon="info" tip="Metadata Panel" onClick={() => setShowMeta(s => !s)} />
      </div>
      <div className="main" id="mainContent" role="main">
        <aside className={['sidebar', sidebarCollapsed && 'collapsed'].filter(Boolean).join(' ')}>
          <div className="sidebar-header">
            <span>Projects</span>
            <button type="button" className="icon-btn collapse-btn" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} data-tip={sidebarCollapsed ? 'Expand' : 'Collapse'} onClick={() => setSidebarCollapsed(c => !c)}>
              <span className="material-symbols-rounded">{sidebarCollapsed ? 'chevron_right' : 'chevron_left'}</span>
            </button>
          </div>
          {!sidebarCollapsed && <div className="project-list">{state.projects.map(p => (
            <div key={p.id} className={['project-item', p.id === project.id && 'active'].filter(Boolean).join(' ')} onClick={() => { setState(s => ({ ...s, activeProjectId: p.id })); toast(`Switched to "${p.name}"`); }} style={{ position:'relative' }}>
              <div style={{ paddingRight: '2rem' }}>{p.name}</div>
              <button type="button" className="proj-del icon-btn danger" aria-label="Delete Project" data-tip="Delete Project" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete project '${p.name}'?`)) deleteProject(p.id); }}><span className="material-symbols-rounded">delete</span></button>
              {p.tags?.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>{p.tags.map(t => <span key={t} className="tag-chip" style={{ color: tagColor(t) }} onClick={(e) => { e.stopPropagation(); toggleFilterTag(t); }}>{t}</span>)}</div>}
              <small>{new Date(p.modified).toLocaleTimeString()}</small>
            </div>))}</div>}
          {!sidebarCollapsed && <div style={{ padding:'0.5rem 0.75rem', borderTop:'1px solid var(--border)' }}>
            <span style={{ fontSize:'.65rem', letterSpacing:'.05em', opacity:.7, textTransform:'uppercase' }}>Project Tags</span>
            <TagEditor tags={project.tags||[]} onAdd={t => updateProject(p => { if(!p.tags.includes(t)) p.tags=[...p.tags,t]; })} onRemove={t => updateProject(p => { p.tags = p.tags.filter(x => x!==t); })} inputRef={projectTagInputRef} />
            {project.tags.length>0 && <button className="icon-btn" data-tip="Clear Project Tags" onClick={() => updateProject(p => { p.tags = []; })}><span className="material-symbols-rounded">backspace</span></button>}
          </div>}
          {!sidebarCollapsed && <div style={{ padding:'0.5rem 0.75rem', borderTop:'1px solid var(--border)', maxHeight:190, overflow:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'.65rem', letterSpacing:'.05em', opacity:.7, textTransform:'uppercase' }}>Tag Palette</span>
              <small style={{ fontSize:'.5rem', opacity:.5 }}>click tag</small>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.35rem', marginTop:6 }}>{paletteTags.map(item => (
              <button key={item.tag} className="tag-filter-btn" onClick={() => quickAddTag(item.tag)} style={{ borderColor: tagColor(item.tag), color: tagColor(item.tag), position:'relative' }}>
                {item.tag}{item.count>0 && <span style={{ fontSize:'.5rem', opacity:.6, marginLeft:4 }}>{item.count}</span>}
                <span onClick={(e) => { e.stopPropagation(); togglePinned(item.tag); }} style={{ position:'absolute', top:-6, right:-6, background:'#000', border:'1px solid var(--border)', borderRadius:12, width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center' }}><span className="material-symbols-rounded" style={{ fontSize:12 }}>{item.pinned ? 'star' : 'star_border'}</span></span>
              </button>))}</div>
          </div>}
          {!sidebarCollapsed && allTags.length>0 && <div style={{ padding:'0.5rem 0.75rem', borderTop:'1px solid var(--border)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'.65rem', letterSpacing:'.05em', opacity:.7, textTransform:'uppercase' }}>Tag Filter</span>
              <div style={{ display:'flex', gap:4 }}>
                <button className="icon-btn" data-tip="Toggle AND/OR" onClick={switchMode}><span className="material-symbols-rounded">{state.filterMode==='AND'?'swap_horiz':'sync_alt'}</span></button>
                {state.tagFilter.length>0 && <button className="icon-btn" data-tip="Export Tag Markdown" onClick={exportByTag}><span className="material-symbols-rounded">download</span></button>}
              </div>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.35rem', marginTop:6 }}>{allTags.map(t => { const active = state.tagFilter.includes(t); return <button key={t} onClick={() => toggleFilterTag(t)} className="tag-filter-btn" style={{ borderColor: active ? tagColor(t) : 'var(--border)', color: active ? tagColor(t) : 'inherit', background: active ? 'var(--bg-elev-3)' : 'var(--bg-elev-2)' }}>{t}</button>; })}</div>
            {state.tagFilter.length>0 && <div style={{ display:'flex', gap:6, marginTop:6 }}><button className="icon-btn" data-tip="Clear Tag Filters" onClick={() => setState(s => ({ ...s, tagFilter: [] }))}><span className="material-symbols-rounded">filter_alt_off</span></button></div>}
            <small style={{ fontSize:'.55rem', opacity:.5 }}>Mode: {state.filterMode}</small>
          </div>}
        </aside>
        <div className="content">
          <div className="scroller">
            <div className="group">
              <h2>Text Boxes</h2>
              <WeightLegend />
              <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                <select onChange={e => { if (e.target.value) { addText(e.target.value); e.target.value=''; } }} defaultValue=""><option value="" disabled>Add Text Box...</option><option value="default">Default</option><option value="subject">Subject</option><option value="style">Style</option><option value="background">Background</option><option value="composition">Composition</option><option value="angle">Angle</option></select>
                <IconButton icon="image" tip="Add Image Box" onClick={addImage} />
              </div>
              <DndContext sensors={sensors} onDragStart={e => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
                <SortableContext items={filteredTextBoxes.map(b => b.id)} strategy={rectSortingStrategy}>
                  <div className="boxes-grid">{filteredTextBoxes.map(b => <SortableBox key={b.id} box={b} setState={setState} onChange={mut => setTextBox(b.id, mut)} onDelete={() => deleteBox(b.id)} onDuplicate={() => duplicateBox(b.id)} toast={toast} invalid={b.category==='subject' && !b.content.trim()} onReorder={delta => moveBox(b.id, delta)} />)}</div>
                </SortableContext>
                <h2>Images</h2>
                <SortableContext items={filteredImageBoxes.map(b => b.id)} strategy={rectSortingStrategy}>
                  <div className="boxes-grid">{filteredImageBoxes.map(b => <SortableImageBox key={b.id} box={b} setState={setState} onChange={mut => setBox(b.id, mut as any)} onDelete={() => deleteBox(b.id)} onDuplicate={() => duplicateBox(b.id)} toast={toast} onReorder={delta => moveBox(b.id, delta)} />)}</div>
                </SortableContext>
                <DragOverlay>{activeId && <div className="prompt-box dragging">Dragging...</div>}</DragOverlay>
              </DndContext>
            </div>
          </div>
          <footer className="status"><div>{filteredTextBoxes.length} text boxes, {filteredImageBoxes.length} image refs</div><div>Merged length: {merged.length}</div></footer>
        </div>
      </div>
      <ToastHost toasts={state.toasts} setState={setState} />
      {showPreview && <div className="preview-modal" onClick={() => setShowPreview(false)}><div className="preview-card" onClick={e => e.stopPropagation()}><h3>Preview Combined Prompt</h3><pre>{merged}</pre><button onClick={() => setShowPreview(false)} className="icon-btn" data-tip="Close" aria-label="Close Preview"><span className="material-symbols-rounded">close</span></button></div></div>}
      {showMeta && <div className="meta-drawer" role="complementary" aria-label="Project metadata"><button className="icon-btn meta-close" onClick={() => setShowMeta(false)} aria-label="Close metadata"><span className="material-symbols-rounded">close</span></button><h3>Metadata</h3><div className="metric-list"><div><span>Text Boxes</span><span>{textBoxes.length}</span></div><div><span>Image Refs</span><span>{imageBoxes.length}</span></div><div><span>Total Words</span><span>{metrics.words}</span></div><div><span>Chars</span><span>{metrics.chars}</span></div><div><span>Est Tokens</span><span>{metrics.estTokens}</span></div><div><span>Avg Weight</span><span>{metrics.avgWeight.toFixed(2)}</span></div></div><h3>Tags</h3><div className="tag-freq">{metrics.tagCounts.map(([t,c]) => <span key={t} style={{ color: tagColor(t) }}>{t}:{c}</span>)}</div></div>}
    </div>
  );
};