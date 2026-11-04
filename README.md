# CodeMirror 6 WYSIWYG OFM Editor

## Credits and References, first of all
### Primary Credits
- https://github.com/segphault/codemirror-rich-markdoc, **_for the foundation of this entire project._**
- https://github.com/erykwalder/lezer-markdown-obsidian, for OFM Lezer Parsers.
- https://github.com/surmon-china/vue-codemirror, for the CodeMirror 6 component in Vue.
- https://github.com/ebullient/markdown-it-obsidian-callouts, for his awesome markdown-to-html callouts markdown-it plugin
- https://github.com/mgmeyers/obsidian-indentation-guides, for indentation guides
- Markdown-It
- https://github.com/thecodrr/alfaaz, for insanely fast word/line-counting functions
- https://github.com/yuri2peter/codemirror-ai-enhancer, for providing the simple AI completion editing experience

### Related References & Resources
- https://github.com/heavycircle/remark-obsidian, for mostly wiki link alias & highlights & callouts parsing
- https://github.com/flowershow/remark-wiki-link, for wiki link parsing
- https://github.com/CTRL-Neo-Studios/simple-markdown-editor, my initial trial that quickly degraded into a shitslop because of overuse of AI
- https://github.com/nothingislost/obsidian-codemirror-options
- https://github.com/nothingislost/obsidian-cm6-attributes

## Disclaimer
I have used DeepSeek V4 Pro + Claude Opus 5 + Claude Sonnet 5 in the process of developing this editor numerous times, so do expect errors or inconsistencies in some parts of the code.

## Introduction
Do I even need an intro?

This is a CodeMirror 6 WYSIWYG Obsidian-Flavored Markdown Editor project that aims to recreate Obsidian's implementation of a WYSIWYG Markdown editor in CodeMirror 6.

That being said, please do note that:
- This is more of a synthesized project from multiple different projects, as you can see from the credits section
- The CodeMirror implementation is not a one-on-one replica. Since we don't have access to Obsidian's AST, we don't know how they parse markdown into node-marks and decorating them with CodeMirror. We could only try to imitate how they parse and decorate their markdowns judging from the class styling in their raw HTML.
- When using this editor, you may feel that some small user experiences does not mach the UX of Obsidian's markdown editor. Yes, this is a known issue, and we're trying to "fix" them.

## Installation

Run with your preferred package manager:
```shell
bun add @type32/codemirror-rich-obsidian-editor
```

Add module in Nuxt Config:

```ts
export default defineNuxtConfig({
	// Your config...
	modules: [
		// Your other modules...
		'@type32/codemirror-rich-obsidian-editor',
	],
})
```

Customize the editor fonts:

```css
@import 'tailwindcss';
@import '@nuxt/ui';

@theme static {
	/* Your Config Here... */
	
	--font-sans: /* Your Config Here... */;

	--font-editor: 'SF Pro Display', 'Segoe UI Variable Static Display', var(--font-sans, sans-serif);

	--font-editor-code: 'Google Sans Code', 'JetBrains Mono', 'Consolas', var(--font-mono, ui-monospace);

	/* List indentation / spacing.
	   UL and OL have independent step / gap pairs so ordered lists can be
	   tuned to a tighter or wider nesting than unordered lists.

	     --ul-nesting-step: horizontal distance added per nesting level (UL).
	     --ul-bullet-gap:   width of the `•` bullet slot (also the visual gap
	                        between bullet and content text).
	     --ol-nesting-step: horizontal distance added per nesting level (OL).
	     --ol-bullet-gap:   reserved slot width for the `1.` / `2.` marker
	                        (and visual gap between marker and content).
	                        Should be wide enough to hold the largest marker
	                        you expect (default 1.5rem fits up to 3 digits).
	     --list-base-offset: shared editor-frame left-padding baseline. */
	--ul-nesting-step: 1.5rem;
	--ul-bullet-gap:   0.25rem;

	--ol-nesting-step: 1rem;
	--ol-bullet-gap:   0.5rem;

	--list-base-offset: 1rem;

	/* Indent-guide styling for list lines. See `.cm-list-line-ul` / `.cm-list-line-ol` below. */
	--list-guide-color: var(--ui-primary);
	--list-guide-width: 1px;
	--list-guide-opacity: 0.05;

	/* Active indent-guide styling — the guide stripe belonging to the
	   current cursor's ancestor group is highlighted on all sibling lines.
	   See `.cm-list-line-active-guide` below. */
	--list-active-guide-color: var(--ui-primary);
	--list-active-guide-opacity: 1;

	--indent-level: 0;

	/* Your Config Here... */
}
```

## Extensions

Extensions are plain CodeMirror `Extension`s passed through the `extensions` prop. The prop is reactive: change the array and the editor reconfigures in place. `[]` is an empty extension, so toggling one off is a ternary:

```vue
<script setup lang="ts">
import { blockDragHandle, selectionToolbar, slashMenu } from '@type32/codemirror-rich-obsidian-editor/ext'

const showToolbar = ref(true)
const extensions = computed(() => [
	showToolbar.value ? selectionToolbar() : [],
	slashMenu(),
	blockDragHandle(),
])
</script>

<template>
	<Editor v-model="doc" :extensions="extensions" />
</template>
```

Two entry points:
- `@type32/codemirror-rich-obsidian-editor/ext`: default extensions.
- `@type32/codemirror-rich-obsidian-editor/kit`: the authoring API those defaults are built on. A default extension imports nothing a user extension can't.

### Selection toolbar

A formatting bar centred above the selection. It appears after a mouse selection is released or a keyboard selection settles (150 ms), only for selections inside a single paragraph or heading. It never appears in code blocks, tables, frontmatter, or across blocks.

```ts
selectionToolbar() // default: [['bold', 'italic', 'strikethrough', 'highlight'], ['link', 'wikilink']]
selectionToolbar({ items: ['bold', 'italic'] }) // flat list = one group
selectionToolbar({ items: [['bold'], ['link', myAction]] }) // nested arrays = separated groups
selectionToolbar({ items: [] }) // only contributed items (see below); hidden if there are none
```

Built-in action ids: `bold`, `italic`, `strikethrough`, `highlight`, `link` (`[text](url)` via an inline URL input; on an existing link it edits the URL, and an empty URL removes the link), `wikilink` (`[[text]]`).

### Slash menu

Type `/` at the start of a line or after a space (outside code, math, and frontmatter) to open a block menu below it.
- **Filtering:** typing filters by label, id, and keywords (`/h1`, `/todo`, `/latex`).
- **Keys:** ↑/↓ select, Enter or Tab runs, Escape closes.
- **Closing:** it also closes when nothing matches or the cursor leaves the `/…` text.
- **Running an item:** the `/query` text is removed and the action runs on that line. Line types (headings, lists, quote, callout) replace the line's current block prefix. Multi-line blocks (code, math, table, divider) replace an empty line or go below a filled one.

```ts
slashMenu() // default: [[paragraph, heading1–3], [bulletList, orderedList, taskList], [quote, callout, codeBlock, mathBlock, table, divider]]
slashMenu({ items: [['heading1', 'heading2'], ['codeBlock', myAction]] })
```

Contribute items from another extension with `slashItems.of([...])`. Only actions with `run` are listed.

### Block drag handle

`blockDragHandle()` shows a grip left of the hovered block.

**What counts as a block:** a paragraph, heading, code block, math block, table, divider, quote, or callout, each moved as a whole; or a list item, which moves with its nested children. Frontmatter is pinned.

**Dragging:**
- A line marks where the block will land. Escape cancels.
- List item onto list item: it becomes a sibling, re-indented and taking the target list's marker and its tight/loose spacing.
- Anything else moves between top-level blocks, and blank lines are padded so neighbouring paragraphs, quotes, or callouts never merge.
- Ordered lists on both ends are renumbered. Every move is a single undo step.

**Clicking** (without dragging) opens Move up / Move down / Delete. Up and down swap with the neighbouring sibling and are disabled at a boundary (the first or last item of a list, or next to frontmatter).

Known limits: dragging doesn't auto-scroll near the edges (the mouse wheel still scrolls), and drops always land as a sibling (there's no nesting by horizontal offset).

### Writing your own

```ts
import { vueOverlay, type EditorAction } from '@type32/codemirror-rich-obsidian-editor/kit'
import { toolbarItems } from '@type32/codemirror-rich-obsidian-editor/ext'
import WordCount from './WordCount.vue'

// A Vue component mounted once per editor, receiving `editor: EditorContext` as a prop.
export const wordCount = vueOverlay(WordCount)

// Add a button to the default toolbar without touching its config.
const uppercase: EditorAction = {
	id: 'uppercase', label: 'Uppercase', icon: 'i-lucide-case-upper',
	run: (view) => {
		const { from, to } = view.state.selection.main
		view.dispatch({ changes: { from, to, insert: view.state.sliceDoc(from, to).toUpperCase() } })
	},
}
export const uppercaseButton = toolbarItems.of([uppercase])
```

Rules that keep extensions hot-pluggable:
- **Create plugins at module level.** `vueOverlay(...)`, `ViewPlugin`s and `StateField`s must be module constants. CodeMirror keeps a plugin alive across reconfigures only while the *same* plugin object stays in the config. A fresh call inside a `computed` remounts it on every change.
- **Pass per-use options through a `Facet`.** `myFacet.of(options)` can be a new value on every render. That's how `selectionToolbar({ items })` updates without remounting.
- **Overlay components get `editor: EditorContext`**: `{ view, state, update, focused }`. `state` and `update` are shallow refs replaced on every view update. Watch `update` with `flush: 'sync'` if you need every update rather than the last one per tick.
- **Component-mounted UI sees the full Vue tree.** Overlays and widgets render with the Editor's app context *and* its ancestors' provides, so Nuxt UI components that need `<UApp>` (tooltips, toasts) work.

`EditorAction` (`{ id, label, icon?, kbds?, keywords?, color?, run?, panel?, isActive?, isEnabled? }`) is the shared item model. `panel` is a component rendered in place of the action's button (props `{ editor, close }`) for actions that need input, like `link`. `color` (e.g. `'error'`) tints the item in menus.

The kit also exports what the built-ins are made of:
- **Inline commands:** `toggleMark(type)`, `toggleWikilink`, `setLink(url)`
- **Block commands:** `setLinePrefix(prefix)`, `insertBlock(before, after?)`, `moveBlock(block, dir)`, `moveBlockTo(block, target, side)`, `deleteBlock(block)`
- **Queries:** `markAt`, `linkAt`, `wikilinkAt`, `formattableRange`, `blockAt`, `dropTarget`, `canMoveBlock`
- **Surfaces:**
  - `defineItemsFacet()`, to build your own contribution point like `toolbarItems`/`slashItems`
  - `resolveActions`, `filterActions`
  - `ActionList`, the menu component used by the slash and block menus
  - `virtualAnchor`, `floatingContent`, `keepEditorFocus`
- **Helpers:** `mountVueComponent`, `mouseSelectingField`

Ship `.vue` files in an extension? Style them with Nuxt UI props or your own CSS. Tailwind v4 doesn't scan `node_modules`, so utility classes inside a published package won't be generated in the host app.

## Known Issues
- Ordered List sequencing is different than that of Obsidian. We think that they probably use a sort of counter to keep track of lists of the same level beneath the hood, but we don't know for sure.
- Light/Dark themes are not yet supported in code-block syntax highlighting.
- Nested callouts render as a styled blockquote (source visible) instead of a callout widget: `markdown-it-obsidian-callouts` mis-renders nesting, and the old whole-block widget could corrupt the document on edit. Regular callouts render as before.
- Tables are widget-only: the markdown source is never shown. Click a cell to edit (Enter/blur commits, Esc cancels); right-click for a Nuxt UI context menu with insert/delete row & column, alignment, clear cell; drag the `⋮⋮` handles to reorder rows/columns. Malformed tables (bad delimiter row) fall back to plain text so they can be repaired.

### Resolved
- ~~Rendered block replacement recomputes all regions on every operation.~~ Every prose plugin now goes through `createProsePlugin`: inline decorations are viewport-scoped and patch only changed lines; block decorations rebuild only when the selection actually crosses one of the plugin's nodes.
- ~~Marks reveal on `mousedown`; Obsidian reveals on `mouseup`.~~ Decoration rebuilds are suspended while drag-selecting and run once on release.
- ~~Nested callouts can lose data.~~ See above.
- ~~Tables don't render.~~ See above.
- ~~Indents are tabs / list indents are a pain.~~ Indent guides and active-guide highlighting work; the guide-level off-by-one is fixed.
- ~~Task lists don't work.~~ Working.
- ~~Embedded videos/notes/canvases unsupported~~ — `internalLinkMap` lets hosts map links to their own embed components.
- ~~Mermaid/bases code blocks unsupported~~ — `specialCodeBlockMap` lets hosts map a code-fence language to their own component.
- ~~YAML Frontmatter parsed as raw text~~ — deliberately left raw; `useEditorFrontmatter` offers get/set/clear helpers for hosts that want them.

## Contributions
- To anyone who wants to fork this, **make sure you preserve the original credits and references to the libraries that are used in this project. It means a lot to them and to us.**
- To anyone who wants to fork this project into another framework - such as React, Angular, Svelte, or PHP - **best of luck. We don't have react/solidjs/Angular/Svelte/PHP developers on the team so we can't help with that. This project is developed is mostly just Vue/Nuxt in mind.**

PS: You may notice some inconsistencies in the use of pronouns in the README.md: it's not written using AI. It's just my weird writing style.
