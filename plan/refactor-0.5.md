# 0.5 refactor plan — `@type32/codemirror-rich-obsidian-editor`
Status: agreed scope, nothing started. 0.4 (parity work, incl. the `[[` popover) ships first; it is uncommitted on `dev`.
## Decisions (settled with the user)
- **In scope:** plain Vue entry, CodeMirror-only entry, collab-ready editor, comark OFM plugin, host-supplied Markdown syntax.
- **Out of scope:** Tiptap (no extensions, no dedicated utilities entry). IME/multilingual stays deferred.
- **Packaging:** one package. Root = framework-free core. `/vue` = Vue components. `/nuxt` = Nuxt module. Same pattern as `reka-ui` + `reka-ui/nuxt`.
- **CodeMirror-only entry:** tables and properties stay Markdown source unless the host supplies a renderer. The Vue entry supplies ours.
- **Version:** this is 0.5. 1.0 (API freeze) waits until Vertex's plugin refactor has used the surface.
- **Independence:** this package never imports a CRDT library and never knows Vertex Hub exists. Vertex/Hub adapt to this API, or the user passes Vertex's specs later.
## Measured facts the plan rests on
- Only `src/module.ts` imports Nuxt. Nuxt dependence elsewhere is implicit: 15 auto-imported `U*` components, host-compiled CSS, the AI server route.
- Vue inside `src/runtime/editor/` (48 files, ~3,400 lines) has five seams:
  - `kit/vue.ts` (`mountVueComponent`)
  - `plugins/codemirror-widgets/propertiesWidget.ts` → `PropertiesPanel.vue`
  - `plugins/codemirror-widgets/proseTableWidget.ts` → `TableEditor.vue`
  - `plugins/codemirror-plugin-proses/proseLinkCodemirrorViewPlugin.ts` → `ImageEmbedComponent.vue` (plus host components via `proseVueComponentEmbedWidget.ts`)
  - `wysiwyg.ts` → `LinkSuggest.vue`
- Smaller leaks into "pure" files: `LINK_ICONS` (`i-lucide-*`) in `utility/linkSearch.ts`; `vueContextFacet` in `plugins/hostAppConfig.ts`; `Component` type in `types/editor-types.d.ts`.
- Callout and code-block widgets are plain DOM with inline SVG.
- `assets/css/editor.css`: 1,008 lines, 176 `@apply`, imports `tailwindcss` and `@nuxt/ui`, 18 `--ui-*` uses, 82 Obsidian-variable uses.
- `@nuxt/ui` 4.12 exports `./components/*`, `./vue-plugin`, `./vite`.
- `Editor.client.vue`: `v-model` through `vue-codemirror6`; `history()` and `historyKeymap` hard-wired (line ~70); calls `wysiwyg()` with no config, so hosts cannot add Lezer syntax today.
- Filters already skip transactions without a user event (`renumberFilter`, `protectFrontmatter`); `TableEditor.vue` already uses `Transaction.remote` for cell sync.
- comark plugin shape: `defineComarkPlugin(() => ({ name, markdownItPlugins, pre, post }))`. Defaults already cover frontmatter, alerts, task lists.
- `yjs` is in `node_modules` transitively; `y-codemirror.next` and `comark` are not installed.
## Not yet verified (check inside the phase that needs it)
- How `vue-codemirror6` applies an external `modelValue` change (full replace?).
- Whether Nuxt resolves `modules: ['pkg/nuxt']` with `@nuxt/module-builder`'s output, and what the builder needs to emit a non-module root.
- Whether explicit `@nuxt/ui/components/X.vue` imports behave identically to auto-imports inside Nuxt (theme, app config).
- A precompiled stylesheet without Tailwind preflight that still defines the `--ui-*` tokens it uses.
- Concurrent renumbering/table reformatting duplicating text under a CRDT (inference only).
- Which OFM syntax comark's own plugins (alerts, math) already handle acceptably.
## Target exports
| Path | Contents | Needs |
|---|---|---|
| `.` | Parsers, live-preview extension, commands/queries, link search, properties/table/frontmatter models, renderer facets | CodeMirror, Lezer, katex, yaml |
| `/vue` | `Editor` component and the Vue renderers | + Vue, Nuxt UI, Tailwind |
| `/nuxt` | Thin module: components dir, CSS, AI route, aliases, dedupe | + Nuxt |
| `/kit` | Vue toolkit (`vueOverlay`, `mountVueComponent`, actions); keeps re-exporting the pure commands so host imports don't change | Vue |
| `/ext`, `/ext/ai`, `/ext/ai/tools` | Unchanged | Vue, Nuxt UI |
| `/comark` | OFM plugin | comark (optional peer) |
| `/editor.css` | Precompiled stylesheet for hosts without Tailwind/Nuxt UI | — |
**Breaking for Nuxt users:** `modules: ['@type32/codemirror-rich-obsidian-editor']` becomes `…/nuxt`. One line; goes in the migration notes.
## Phase 1 — Collab spike (throwaway, playground only)
Goal: a list of what breaks, before any design. No server.
- Playground page with two `<Editor>`s, each on its own `Y.Doc`, exchanging updates in-page, with a "disconnect" toggle to force concurrent edits. `yCollab(ytext, awareness)` goes in through `extensions`.
- `yjs` and `y-codemirror.next` as playground devDependencies only.
- Run through, connected and disconnected-then-merged:
  - paragraphs; ordered lists (renumbering on both sides);
  - one table: different cells, same cell, add row vs edit cell;
  - properties panel: different keys, same key, add vs delete;
  - callout being edited while the other side edits it;
  - `[[` popover and slash menu open while remote text arrives above;
  - undo/redo with CodeMirror history vs `yUndoManager`;
  - `v-model` behaviour while the binding owns the text;
  - where remote cursors show (body, cell, folded callout, hidden markup).
- Output: findings appended to this file under "Spike findings". Delete the page or keep it as the Phase 3 check.
## Phase 2 — Boundaries
1. **Renderer seams.** Core defines one facet per Vue seam (table, properties, embed, link suggest): `mount(view, el, props) → { update(props), destroy() }`. Unset → source for tables and properties, plain `<img>` for image embeds, no popover for `[[` (field and keymap stay). The Vue layer registers ours through `mountVueComponent`.
2. **Core entry without moving files.** Add `src/runtime/index.ts` as the barrel. Move the three leaks (`LINK_ICONS`, `vueContextFacet`, the `Component` type) to the Vue side.
3. **Boundary test.** One vitest that walks imports from the core entry and fails on `vue`, `*.vue`, `@nuxt/*`, `#imports`, `@vueuse/*`.
4. **Explicit imports in every `.vue` file** (`@nuxt/ui/components/*.vue`, Vue APIs). `ImageEmbedComponent.vue` is the one relying on Vue auto-imports.
5. **`/vue` entry** exporting `Editor` (and the renderers extension for hosts composing their own view).
6. **`/nuxt` entry**: `module.ts` behind the new path; extend its alias pinning to the new subpaths.
7. **CSS**: build step emitting `dist/editor.css` (no preflight). Nuxt and Vue + Nuxt UI hosts keep the source stylesheet.
8. **Dependencies**: `@nuxt/kit`, `@nuxt/ui`, `tailwindcss`, `vue-codemirror6` become optional peers.
9. **Proof**: two tiny fixtures beside `playground/` — vanilla Vite + CodeMirror (no Vue), and Vite + Vue + Nuxt UI. Browser-check each; the Nuxt playground must look unchanged.
## Phase 3 — Collab-ready editor
Driven by the spike; expected items:
- **History**: `history` prop (default `true`); `false` drops `history()` and `historyKeymap` so the host adds its own.
- **Document ownership**: `v-model` becomes output-only when the host owns the text. If `vue-codemirror6` can't do that, replace it with a direct `EditorView` in `Editor` (also removes a peer).
- **Derived text**: fix whatever the spike shows for renumbering and table reformatting.
- **Remote cursors in widgets**: scope from the spike; may be documented as a limitation in 0.5.
- **Check**: vitest with two `EditorState`s on two `Y.Doc`s for each case fixed (`yjs` as devDependency).
- **Docs**: README "Collaboration" recipe using y-codemirror.next. No runtime dependency added.
## Phase 4 — Host Markdown syntax
- `<Editor>` passes a `markdown` option (`{ extensions, codeLanguages }`) into `wysiwyg(config)` inside a Compartment; changing it reparses. Nested editors inherit through `nestedEditorContent`. `parseMarkdownToAST` takes the same config.
- Use `codeLanguages` display names for the code-block flair (known gap).
- README: list the surface plugins may depend on (tree node names, facets, fields, CSS classes), marked unstable until 1.0.
- **Check**: test that adds an inline syntax and a decoration through `extensions` and sees both.
## Phase 5 — comark plugin (`/comark`)
- First: run the `_parity-lab` notes through stock comark and record what already renders.
- Then `defineComarkPlugin` with markdown-it rules for the rest: `[[target#heading|alias]]`, `![[embed]]`, `==highlight==`, `%%comment%%`, `#tag`, `^block-id`, callouts (types, aliases, fold, title from core's table), task statuses, math only if comark's plugin falls short.
- Output nodes carry props (`target`, `heading`, `alias`, `calloutType`, …) so hosts map them to components. Option `resolveLink(target)` fed by `InternalLink[]`.
- **Parity guard**: shared fixtures in `test/fixtures/ofm/`; one test asserts the Lezer tree and the comark tree find the same constructs in each.
- Independent of Phases 3–4; can run alongside once Phase 2.2 exposes the core entry.
## Phase 6 — Docs and release
- README install section per target (CodeMirror, Vue, Nuxt), migration note for `/nuxt`.
- `WHATS-NEW-0.5.md`. CHANGELOG stays generated.
## Order
1 → 2 → 3 → 4 → 6, with 5 alongside from 2.2 onward. Each phase ends with `bunx vitest run`, `bunx vue-tsc --noEmit` and a browser check.
## Waiting on Vertex (not planned here)
- Plugin loader and trust model; handing plugins the host's `@codemirror/*` instances.
- CRDT library, provider, end-to-end encryption, canvas collaboration, everything in Vertex Hub.
- 1.0 API freeze.
## Spike findings
(empty)
