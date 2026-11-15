# What's new in 0.5 (since 0.4)

0.5 makes the editor usable outside Nuxt: a framework-free core for any CodeMirror 6 editor, Vue components for any Vue app with Nuxt UI, and the Nuxt module on top. Work in progress; this file grows with the release.

## Breaking changes

- **The Nuxt module moved to `/nuxt`.** In `nuxt.config.ts`, `modules: ['@type32/codemirror-rich-obsidian-editor']` becomes `'@type32/codemirror-rich-obsidian-editor/nuxt'`. The package root is now the core.
- **The `#codemirror-rich-obsidian-editor` aliases are gone** (`#codemirror-rich-obsidian-editor/editor-types` and `#codemirror-rich-obsidian-editor#css`). Import the types from the package root: `import type { InternalLink } from '@type32/codemirror-rich-obsidian-editor'`.
- **`.vue-embed-widget` is now `.cm-embed-widget`.** Embeds aren't only Vue components any more (see below).
- **Image embeds (`![alt](src)`, bare image URLs) are plain DOM**, `.cm-image-embed > img` and its caption `div`, styled by `editor.css` as before. They used to mount `ImageEmbedComponent`, which is still exported for your own `embedComponent`s.
- **`InternalLink.embedComponent` and `SpecialCodeBlockMapping.component` are typed `unknown`**, so the types don't depend on Vue; pass a Vue component as before. `SpecialCodeBlockMapping.component` is optional now (or give `mount`).
- **`@nuxt/kit` is an optional peer dependency** instead of a dependency; Nuxt apps have it. `@nuxt/ui`, `tailwindcss`, `vue` and `vue-codemirror6` are optional peers too: a CodeMirror-only app needs none of them.

## Entries

| Import | For | Contents |
|---|---|---|
| `@type32/codemirror-rich-obsidian-editor` | any CodeMirror 6 editor | `wysiwyg()`, its facets, commands and queries, link search, `[[` completion state, renderer facets, `nestedExtensions`, frontmatter and table helpers, every type |
| `…/vue` | Vue + Nuxt UI | `Editor`, `CodeEditor`, `ImageEmbedComponent`, `vueRenderers()`, `mountVueComponent` |
| `…/nuxt` | Nuxt | the module |
| `…/kit`, `…/ext`, `…/ext/ai` | unchanged | |
| `…/editor.css` | hosts without Tailwind | precompiled stylesheet |
| `…/tailwind.css` | Vue hosts with Tailwind and Nuxt UI | the source stylesheet (Nuxt adds it itself) |

- **The core imports no Vue or Nuxt, not even types.** A test walks its imports.
- **`kit` names are unchanged:** `slashItems`, `toolbarItems`, `defineItemsFacet`, `editorLabels`, `vueOverlay`, `EditorContext`, `headingsField`, `headingAt`. The pure ones are also exported from the root, from the same modules, so a facet registered through one path is the one the editor reads through the other.
- **Types and frontmatter helpers come from the root:** `InternalLink`, `InternalLinkClickDetail`, `ExternalLinkClickDetail`, `SpecialCodeBlockMapping`, `PropertiesOptions`, `PropertyType`, `Frontmatter`, `EmbedMount`, …, and `parseFrontmatter`, `parseYaml`, `stringifyYaml`, `frontmatterRange`. `dist/runtime/utils/frontmatter.js` stays where it is through 0.5.

## CodeMirror only

- `wysiwyg()` in your own `EditorView` renders the note: marks, links, tags, math, tasks, lists, callouts (their nested editors included), code blocks, images, `mount` embeds.
- Tables and the frontmatter stay markdown unless you set `tableRenderer` / `propertiesRenderer`. A renderer is `(view, el, props) => { update(props), destroy() }`.
- `[[` completion is state and commands (`linkSuggestPlugin`, `linkSuggestionsIn`, `pickLinkSuggestion`); its list is yours to draw.
- `editor.css` (91 KB, 11 KB gzipped) holds Tailwind's theme, the utilities the editor applies, and Nuxt UI's tokens with its default colours. It has no preflight and doesn't style `body`. Scope: an element with `.cm-rich-editor`; `.dark` on an ancestor for dark colours.

## Vue

- `Editor` from `/vue` in an app set up for Nuxt UI (its Vite plugin, `app.use(ui)`, `<UApp>`).
- **Every component imports what it uses** (`@nuxt/ui/components/*.vue`, Vue's API) instead of relying on Nuxt's auto-imports. `<ClientOnly>` is gone from `Editor` and `CodeEditor`.
- **The Nuxt module dedupes `@nuxt/ui` and `reka-ui`**, as it does CodeMirror: with two copies (a linked package, a workspace), a tooltip couldn't find `<UApp>`. Vue apps add `resolve.dedupe` themselves if that can happen.

## Embeds and custom code blocks

- **`mount` functions.** `InternalLink.embedMount` and `SpecialCodeBlockMapping.mount` take `(el, props) => teardown | void`, with the props the component gets. They take precedence over the component, and need no Vue.
- **When an embed re-renders:** a prop changes, or the function or component is a different one. Links rebuilt as new, equal objects keep their embeds. Keep one function per kind of embed rather than a new closure per rebuild.
- **Fixed: an embed could stay mounted after its text was deleted.** When the link list was rebuilt with equal links, CodeMirror kept the rendered embed but handed it to the new widget object, which didn't know how to tear it down. Teardown is now kept per element.
- **A component without the Vue layer** (`<Editor>`, `vueRenderers()`) renders as a link or code, not an empty box.

## Nested editors

- **`nestedExtensions.of(extension)`** installs an extension in every nested editor too (callout titles and bodies, table cells), and they pass it on to theirs, so a table inside a callout gets it. Opt-in: the editor's own extensions don't reach nested editors, so menus and overlays aren't mounted once per cell.
- `<Editor>`'s Vue UI (tables, properties, the `[[` popover, component embeds) reaches nested editors this way.
