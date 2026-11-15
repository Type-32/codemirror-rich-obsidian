# 0.5 refactor plan — `@type32/codemirror-rich-obsidian-editor`

Status: Phases 1 (collab spike), 2 (boundaries) and 3 (collab-ready editor) done. Next: Phase 4. User-facing changes are tracked in `WHATS-NEW-0.5.md`.

Already done in 0.4 for Vertex: `alfaaz` removed from `build.transpile` in `module.ts` (CommonJS, was kept out of pre-bundling). Vertex can delete its `nuxt.config.ts` hook when it upgrades.

## Decisions (settled with the user)

- **In scope:** plain Vue entry, CodeMirror-only entry, collab-ready editor, comark OFM plugin, host-supplied Markdown syntax.
- **Out of scope:** Tiptap (no extensions, no dedicated utilities entry). IME/multilingual stays deferred.
- **Packaging:** one package. Root = framework-free core. `/vue` = Vue components. `/nuxt` = Nuxt module. Same pattern as `reka-ui` + `reka-ui/nuxt`.
- **CodeMirror-only entry:** tables and properties stay Markdown source unless the host supplies a renderer. The Vue entry supplies ours.
- **Version:** this is 0.5. 1.0 (API freeze) waits until Vertex's plugin refactor has used the surface.
- **Independence:** this package never imports a CRDT library and never knows Vertex Hub exists. Vertex/Hub adapt to this API, or the user passes Vertex's specs later.
- **Vertex's plugin contract** (five requirements from the user, 2026-11-15) is covered; each is tagged **[V1]–[V5]** where it lands below.

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
| `.` | Parsers, live-preview extension, commands/queries, link search, properties/table models, renderer facets. **[V3]** all public types. **[V4]** `parseFrontmatter`, `parseYaml`, `stringifyYaml`, `frontmatterRange` | CodeMirror, Lezer, katex, yaml |
| `/vue` | `Editor` component and the Vue renderers | + Vue, Nuxt UI, Tailwind |
| `/nuxt` | Thin module: components dir, CSS, AI route, aliases, dedupe | + Nuxt |
| `/kit` | Vue toolkit (`vueOverlay`, `mountVueComponent`, actions); keeps re-exporting the pure commands so host imports don't change. **[V5]** names frozen, see below | Vue |
| `/ext`, `/ext/ai`, `/ext/ai/tools` | Unchanged. **[V5]** names frozen | Vue, Nuxt UI |
| `/comark` | OFM plugin | comark (optional peer) |
| `/editor.css` | Precompiled stylesheet for hosts without Tailwind/Nuxt UI | — |

**[V5] Names that do not change in 0.5** (Vertex's contract exposes them as they are): `slashItems`, `toolbarItems` from `/ext`; `defineItemsFacet`, `editorLabels`, `vueOverlay`, `EditorContext`, `headingsField`, `headingAt` from `/kit`. Where a pure one (`editorLabels`, `headingsField`, `headingAt`) is also exported from the root, both paths must resolve to the same module, or facet identity breaks; the fixtures in 2.9 check this.

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
   - **[V3] Types.** `editor-types.d.ts` becomes a real `.ts` module exported from the root: `InternalLink`, `InternalLinkClickDetail`, `ExternalLinkClickDetail`, `SpecialCodeBlockMapping`, `PropertiesOptions`, `PropertyType`, `Frontmatter`, `SearchOptions`, `WysiwygPlugin`. **Both Nuxt aliases are removed in 0.5** (`#codemirror-rich-obsidian-editor`, `#codemirror-rich-obsidian-editor#css`): neither is in the README, Vertex doesn't need them kept, and 0.5 already breaks the module path. Listed in the migration notes; the playground moves to the public path.
   - **[V4] Frontmatter helpers.** `utils/frontmatter.ts` exported from the root, so nothing imports from `dist/runtime/utils/…`. Nuxt auto-imports of `utils/` stay. Five Vertex tests import `dist/runtime/utils/frontmatter.js` today: that file does not move in 0.5 (no files move, see 2.2), so they keep passing until K4 switches them to the root export.
   - **[V2] Mount functions for code blocks and embeds.** `SpecialCodeBlockMapping` and `InternalLink` accept `mount(el, props) → disposer` as well as a Vue component (`component` / `embedComponent`). Core's embed widget calls `mount` directly; a component goes through a mounter the Vue layer registers, so a component without the Vue layer is ignored with a dev warning. This is Vertex's shape, not the internal seam's: these widgets are recreated when their props change, so no `update` is needed. Props stay as today (`codeContent`; `display`, `componentProps`).
     - **Equality (confirmed in 0.4.4, kept as the contract):** the widget is reused when `component`/`mount` is the same reference and every prop is `===` or JSON-equal (functions and components ignored). Rebuilding the link list with new, equal objects does not remount. A new `mount` closure or component object per rebuild does.
     - **To check while rewriting this widget:** it keeps its disposer on the widget instance, unlike the table and properties widgets, which key theirs by element. If CodeMirror swaps in the new equal instance and later calls `destroy` on it, the mount would never be disposed. Unverified; write the test first, then key the disposer by element.
3. **Boundary test.** One vitest that walks imports from the core entry and fails on `vue`, `*.vue`, `@nuxt/*`, `#imports`, `@vueuse/*`.
4. **Explicit imports in every `.vue` file** (`@nuxt/ui/components/*.vue`, Vue APIs). `ImageEmbedComponent.vue` is the one relying on Vue auto-imports.
5. **`/vue` entry** exporting `Editor` (and the renderers extension for hosts composing their own view).
6. **`/nuxt` entry**: `module.ts` behind the new path; extend its alias pinning to the new subpaths.
7. **CSS**: build step emitting `dist/editor.css` (no preflight). Nuxt and Vue + Nuxt UI hosts keep the source stylesheet.
8. **Dependencies**: `@nuxt/kit`, `@nuxt/ui`, `tailwindcss`, `vue-codemirror6` become optional peers.
9. **Proof**: two tiny fixtures beside `playground/` — vanilla Vite + CodeMirror (no Vue), and Vite + Vue + Nuxt UI. Browser-check each; the Nuxt playground must look unchanged.

**Phase 2 done (2026-11-15).** Differences from the plan above:
- **Fewer seams.** Image embeds are plain DOM in core (an `EmbedWidget` with a core `mount`), so there is no image seam. Three renderer facets remain (`editor/plugins/renderers.ts`): `tableRenderer`, `propertiesRenderer` (`Renderer<P> = (view, el, props) => { update, destroy }`) and `componentMounter` (Vue components given as `embedComponent` / `component`). Link suggest is not a facet: `wysiwyg()` no longer includes it, and the Vue layer adds `linkSuggestPlugin` + its overlay.
- **[V1] pulled forward from Phase 4.** `nestedExtensions` (in `utility/nestedEditor.ts`) is how the Vue layer reaches nested editors: `vueRenderers(context)` (`src/runtime/vue/renderers.ts`) returns `[ui, nestedExtensions.of(ui)]`, with `vueContextFacet` (moved to `kit/vue.ts`) inside. Nested editors install and re-provide it.
- **[V2]** `InternalLink.embedMount`, `SpecialCodeBlockMapping.mount` (`EmbedMount`); the disposer bug was real (CodeMirror 6.43 `findWidget` hands the old DOM to the new equal widget), fixed by keying teardown by element; browser-checked with the playground's `Widget.canvas` (`window.__liveEmbeds`).
- **Nuxt UI dedupe.** Explicit `@nuxt/ui/components/*.vue` imports resolved to the repo root's copy in the playground, so `UTooltip` didn't find the playground's `<UApp>`. The module now dedupes `@nuxt/ui` and `reka-ui`.
- **CSS.** `scripts/build-css.mjs` builds `dist/editor.css` from `build.config.ts`'s `rollup:done` hook (unbuild validates exports before `build:done`). It cuts Nuxt UI's `@source` lines and `body` styles and adds its default palette (Nuxt UI sets colours at runtime). 91 KB / 11 KB gzipped. `/tailwind.css` exports the source stylesheet.
- **Proof.** `fixtures/vanilla` (CodeMirror only, no Vue loaded) and `fixtures/vue` (Vite + Vue + Nuxt UI) run against the built `dist` through the package's own exports; browser-checked, including `[[`, the slash menu, the toolbar tooltip, menus and `v-model`. Tests stub Nuxt UI's components (`vitest.config.ts`).

## Phase 3 — Collab-ready editor

Driven by the spike (findings F1–F8 below):

- **[F4] History**: `history` prop (default `true`); `false` drops `history()` and `historyKeymap` so the host adds its own (`Y.UndoManager` + `yUndoManagerKeymap`).
- **[F6] Document ownership**: `v-model` becomes output-only when the host owns the text (a prop, e.g. `:sync="false"`, or detect it). `vue-codemirror6` always applies a differing `modelValue` as a whole-document replace, so this likely means a direct `EditorView` in `Editor` (also removes a peer).
- **[F1] Properties panel writes a minimal diff** instead of the whole frontmatter (`PropertiesPanel.vue:30`). Reuse `TableEditor.vue`'s `diff` (move it to `utility/`).
- **[F2] Table structural edits write a minimal diff** instead of the whole table (`TableEditor.vue:34`, `commit`).
- **[F3] List renumbering under concurrency — decided: the host decides.** Expose a facet (e.g. `renumberRemote`) the host fills with whether this peer repairs numbering after remote changes (e.g. the lowest awareness client id among the peers, or never). Default: never, which is today's behaviour. Renumbering on remote transactions then runs only where the host says, so exactly one peer repairs when the host elects one.
- **[F8] Body line after frontmatter**: same mechanism as F3. The host decides whether this peer adds the line, default as today.
- **[F7] Remote cursors in widgets**: documented as a 0.5 limitation (frontmatter cursors draw at the first body line; table and callout widgets show none). Revisit with Vertex's collab work.
- **Check**: vitest with two `EditorState`s on two `Y.Doc`s for each case fixed (`yjs` as devDependency).
- **Docs**: README "Collaboration" recipe using y-codemirror.next: build `yCollab` once per document, never per render [F5]; put `yUndoManagerKeymap` above the editor's keymap or turn off `history`; write the host's changes into the `Y.Text`, not `v-model`. No runtime dependency added.
- **Spike page**: `playground/app/pages/collab.vue` stays as this phase's browser check (`?yundo=1` for `Y.UndoManager`); `yjs`, `y-codemirror.next`, `y-protocols` are playground devDependencies.

**Phase 3 done (2026-11-15).** As planned, with these specifics:
- **F6 without replacing `vue-codemirror6`:** it gets only the first `v-model` value; `Editor` writes later ones itself as `textChanges` (`syncFromModel`, skipped while composing). No ownership prop needed.
- **`textChanges(a, b, at)`** (`utility/textChanges.ts`, exported from the root): common prefix/suffix trimmed, then `diffChars` from `diff` (already a dependency) on the middle, capped (20k chars, 1k edits) to one replacement. Used by the panel, table `commit`, the cell escape filter and cell sync, and `Editor`.
- **F3:** `listRenumbering` takes `boolean | (tr) => boolean`. User edits it accepts renumber in the same transaction (as before); other accepted changes (no user event) get a separate transaction from `renumberAfterOthers`, since y-codemirror.next skips updates whose first transaction is remote. Only one peer may renumber at all, not just "repair": two peers fixing their own edits is what made `4.4.`.
- **F8:** `bodyLineAfter` facet (`(tr) => boolean`, default all). Focus still always adds the line, so two peers opening a frontmatter-only note offline at once still get two lines (accepted: an extra blank line).
- **F4:** `history` prop, read at mount. Table cells forward Mod-z/Mod-y to the note's keymap (`runScopeHandlers`), so they reach a collaboration undo manager.
- **F2 residue:** structural table edits re-pad every cell; padding inserted where a peer is typing in a cell merges as `d  B`. Table and text survive; avoiding it means not re-padding on structural edits (a formatting change, not made).
- **Found:** an inline array literal for `internal-link-map` reconfigures the editor on each parent render, which rebuilds tables and drops a cell's focus while typing (pre-existing, also without collaboration). Documented in the README; not guarded (deep comparison of link maps per render).
- **Checks:** `test/collab.test.ts` (two `Y.Doc`s: F1, F2, F3, F6), and the `/collab` page by real typing and clicks: lists offline and connected, a property edited through the panel on each peer, a column added from the table menu while the other types in a cell, undo/redo including from inside a cell, a host `v-model` write during an offline edit.

## Phase 4 — Host Markdown syntax and nested extensions

- `<Editor>` passes a `markdown` option (`{ extensions, codeLanguages }`) into `wysiwyg(config)` inside a Compartment; changing it reparses. Nested editors inherit through `nestedEditorContent`. `parseMarkdownToAST` takes the same config.
- Use `codeLanguages` display names for the code-block flair (known gap).
- README: list the surface plugins may depend on (tree node names, facets, fields, CSS classes), marked unstable until 1.0.
- **[V1] Nested editors take host extensions.** Today `nestedEditor()` copies the link map, code-block map, labels, Vue context, bracket closing and tab size, and nothing from the `extensions` prop. Add a `nestedExtensions` facet in core: whatever a host or plugin provides through it is also installed in callouts and table cells, and re-provided so callouts inside callouts get it too. Opt-in, not "all extensions": the slash menu, the AI panel, overlays and a collab binding must not be instantiated per cell. The facet's value joins `nestedInputs`, so widgets re-render when it changes.
- **Check**: test that adds an inline syntax and a decoration through `extensions` and sees both, and that a decoration provided through `nestedExtensions` shows inside a callout, a table cell, a callout inside a callout, and a table inside a callout.

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

Run 2026-11-15 in `playground/app/pages/collab.vue`: two `<Editor>`s, each with its own `Y.Doc`, relayed in-page; "offline" = the relay switched off, then both docs exchange what they missed. Typing, clicks and keys were real. The properties panel and table structural edits were replayed as the single dispatch their code makes (`PropertiesPanel.vue:30`, `TableEditor.vue:34`), not clicked.

**Works unchanged**
- Paragraph typing both ways; `v-model` on both sides stays equal to the document (it emits on remote changes).
- Callout source edited on both sides at once.
- Table cell typing: different cells and the same cell merge (`| cA | dB |`, `| cAB | d |`). Cell writes are already minimal.
- The `[[` popover and the slash menu stay open, keep their items, and insert at the right place while remote text arrives above.
- Filters (renumbering, frontmatter protection) ignore remote transactions: y-codemirror.next dispatches them with `ySyncAnnotation` and no user event. No console errors.

**Breaks**
- **F1 Properties panel duplicates the frontmatter.** Two offline edits to different keys merged into `---\n…\n------\n…\n---`. The same two edits as minimal changes merged cleanly.
- **F2 Table structural edit loses the table.** Add-column (whole-table replace) on A plus a typed cell on B merged into `B| a | b | x |…`: B's text lands before the header row and the table stops rendering. Yjs keeps the character; the replace moved it outside the table.
- **F3 List renumbering.** A adds an item after `1.`, B after `2.`, offline: merged into `1. one\n2. a\n3. two\n3. b\n4.4. three`. Both peers rewrote the same `3`, so both `4`s survive; renumbering never repairs it, because it only runs on local user events.
- **F4 CodeMirror history undoes other people's edits.** A types `x`, B types `y`, A presses Mod-z: `y` is removed, `x` stays. With `Y.UndoManager` and `yUndoManagerKeymap` at `Prec.highest`, each peer undoes only its own text and redo works.
- **F5 Rebuilding `yCollab` breaks undo.** A new `yCollab(...)` per render (e.g. inside a `computed`) leaves y-codemirror.next's sync plugin, a module-level `ViewPlugin` that survives reconfigure, on the old config while the undo manager tracks the new one: the peer's own edits are no longer undoable. Same rule as the README's "create plugins at module level".
- **F6 Host writes through `v-model` replace the whole document.** `vue-codemirror6` dispatches `{ from: 0, to: length, insert }`, which reaches Yjs as delete-all + insert-all; a concurrent edit by B survives, but not where B typed it.
- **F7 Remote cursors.** Drawn in body text, including rendered headings and lists. A cursor in the frontmatter draws at the start of the first body line; a cursor in table or callout source, or in a table cell being edited, is not drawn.
- **F8 Frontmatter-only note.** Both peers focusing offline each add the body line: `---\na: 1\n---\n\n`. Harmless extra blank line.

**Not covered:** latency while connected (the relay is synchronous, so connected edits never conflicted); IME; more than two peers. (Undo inside a cell under `Y.UndoManager`: covered in Phase 3.)
