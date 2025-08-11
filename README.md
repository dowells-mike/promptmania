# PromptMania

Comprehensive prompt builder for crafting weighted, tagged multi-part prompts with text + image references.

## Running

```bash
npm install
npm run dev
```

## Implemented
- Project CRUD: create / load (JSON) / delete, auto localStorage persistence
- Collapsible glassmorphic sidebar with project list + project tag chips
- Text boxes (category badges, weights 0–5, rich text (bold/italic/underline/clear/headings/inline code/link/color), tagging, duplicate / clear / delete / copy)
- Image reference boxes (base64 inline storage, description, filename display, tagging, duplicate / clear / delete / copy)
- Enforced ordering constraint (all text boxes before image boxes)
- Drag & drop reordering (separate groups) via dnd-kit
- Tag system: project + box tags, deterministic colors, palette with pinned tags, quick add, AND/OR tag filtering, tag-based Markdown export
- Platform formatting presets (Plain, Midjourney, Stable Diffusion, DALL-E) applied to merged prompt
- Merged prompt preview modal + copy full prompt
- Undo / Redo history (compressed snapshots w/ LZ-string, memory limited)
- Keyboard shortcuts (Ctrl/Cmd+S save, Z undo, Y / Shift+Z redo, F focus search, Shift+T focus project tag input)
- Search filter (text boxes)
- Metadata panel (counts: boxes, images, words, chars, est tokens, avg weight, tag frequencies)
- Weight visualization (gradient intensity + left bar + legend)
- Toast notifications system (auto-expiring)
- Error boundary + basic validation (required project name on save, required subject box highlight)
- Collapsible / glass UI styling, icon buttons, deterministic tag colors
- GitHub CI workflow (lint, type check, build, test placeholder)
- Baseline .gitignore

## Next Steps
- Templates & preset starter layouts
- Advanced exports (.prj, richer structured Markdown sections, multi-project metadata)
- Advanced tagging: bulk ops / multi-select, suggestions (heuristics/AI), manual color overrides
- Accessibility & focus: enhanced DnD ARIA, focus rings everywhere, screen reader reorder instructions
- Virtualized box list (performance with many boxes)
- Expanded validation (image size/type limits, weight bounds UI feedback)
- Additional export formatting presets & per-platform token estimates
- Testing & migration/versioning strategy (Vitest + schema migrateProject)
- History improvements (true diff compression, compress future stack)
- Rich text semantic output pipeline (HTML → markdown/plain optimization, more block types)

## Roadmap (Condensed)
- Enhanced Tagging & Metadata: bulk operations, intelligent suggestions, advanced exports, and accessibility improvements.

---
Iterate rapidly; keep scope lean while layering power features behind a clear, fast UI.
