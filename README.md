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

Entry points:
- `@type32/codemirror-rich-obsidian-editor/ext`: default extensions.
- `@type32/codemirror-rich-obsidian-editor/ext/ai` (+ `/ext/ai/tools` for servers): the opt-in AI assistant; needs the optional peers `ai` and `@ai-sdk/vue`.
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

### AI assistant

`aiAssistant()` from `@type32/codemirror-rich-obsidian-editor/ext/ai`. AI here only ever **proposes**:
- **Nothing appears unless invoked.** The entry points are the selection toolbar's **Ask AI** button, the slash menu's AI items (Ask AI, Continue writing, Outline, Brainstorm ideas), and `Mod-j`. There's no ghost text or auto-suggest.
- **Every result opens in a floating preview** over its target text. Rewrites show a word diff; you can edit the result, refine the instruction and re-run, Retry, or Discard (Esc).
- **Only Accept (⌘/Ctrl+Enter) writes**, as one undo step tagged `userEvent: 'input.ai'`. The library stores nothing about AI in the document; filter `tr.isUserEvent('input.ai')` if your app wants provenance.
- **If the target text changes while a preview is open**, Accept is disabled until you Retry.
- **Brainstorm results are notes, not edits:** Insert below or Copy, never Accept.

It needs the optional peers `ai` and `@ai-sdk/vue` (`bun add ai @ai-sdk/vue`). Without them, `/ext/ai` resolves to a stand-in with the same exports: `aiAssistant()` logs a warning and adds nothing, so the editor keeps working.

The editor streams through ai-sdk's `useCompletion`. Your server route receives `{ prompt, preset, mode, ...body }` and answers with a UI message stream. The prompt is complete: instruction, outline, surrounding text, and output rules.

```ts
// server/api/ai.post.ts
import { streamText } from 'ai'

export default defineEventHandler(async (event) => {
	const { prompt } = await readBody(event)
	return streamText({ model: 'openai/gpt-4o-mini', prompt }).toUIMessageStreamResponse()
})
```

```ts
aiAssistant() // api: '/api/ai', toolbar + slash items, Mod-j
aiAssistant({
	api: '/api/rewrite',
	headers: { authorization: token },
	body: { documentId }, // merged into every request
	presets: { selection: [...selectionPresets, myPreset], cursor: cursorPresets },
	toolbar: false, slash: true, shortcut: 'Mod-Shift-a', // shortcut: false = none
})
```

An `AiPreset` is `{ id, label, icon?, keywords?, instruction, mode? }`. The `mode` says where the result goes:
- `replace`: the default with a selection.
- `insert`: inline at the cursor; the default without a selection.
- `block`: its own block at the cursor line.
- `reference`: shown only.

`openAi(view, preset?)` opens the panel from your own buttons.

**Chat lives in your app; the editor supplies the tools.** `editorTools` (from `/ext/ai/tools`, server-safe, imports only `ai`) are `readDocument`, `readSelection`, `proposeEdit({ find, replace })`, and `proposeInsert({ text, after? })`. They have no `execute`: tool calls reach the browser, where `runEditorTool` shows proposals in the same preview.
- A call resolves `{ status: 'accepted' | 'rejected', text? }` once the user decides, so the model learns the outcome.
- `find` and `after` must match the document exactly once; otherwise the model gets an `{ error }` telling it to quote more text.
- Several proposals queue up ("1 of 3").

```ts
// server/api/chat.post.ts
import { convertToModelMessages, streamText } from 'ai'
import { editorTools } from '@type32/codemirror-rich-obsidian-editor/ext/ai/tools'

export default defineEventHandler(async (event) => {
	const { messages } = await readBody(event)
	return streamText({ model, messages: await convertToModelMessages(messages), tools: editorTools }).toUIMessageStreamResponse()
})
```

```ts
// client
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { isEditorTool, runEditorTool } from '@type32/codemirror-rich-obsidian-editor/ext/ai'

const chat = new Chat({
	transport: new DefaultChatTransport({ api: '/api/chat' }),
	sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
	onToolCall({ toolCall }) {
		if (!isEditorTool(toolCall)) return
		// Don't await inside onToolCall: the result arrives when the user accepts or rejects.
		runEditorTool(editor.value.view, toolCall).then(output =>
			chat.addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output }))
	},
})
```

The playground (`playground/server/utils/model.ts`) uses the first provider it finds:
1. Local Ollama (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`).
2. OpenRouter (`OPENROUTER_API_KEY`).
3. Vercel AI Gateway (`AI_GATEWAY_API_KEY`).
4. Any OpenAI-compatible endpoint (`OPENAI_COMPATIBLE_BASE_URL`).

Known limits:
- Context is fixed windows (about 1500 characters before the target and 500 after, cut to whole blocks).
- `readDocument` returns the whole document.
- The diff is word-level, not markdown-aware.
- There's no AI entry in the block menu yet.

### Table of contents

There's no built-in UI; the outline is data for your sidebar.
- `headingsField` keeps the top-level ATX headings (`{ level, text, from }[]`) current as the document and its syntax tree change.
- `headings(state)` reads them, from the field when it's configured.
- `headingAt(state, pos)` is the section containing `pos`.

```ts
import { EditorView } from '@codemirror/view'
import { headingsField, type Heading } from '@type32/codemirror-rich-obsidian-editor/kit'

const outline = ref<Heading[]>([])
const extensions = [headingsField, EditorView.updateListener.of(u => { outline.value = u.state.field(headingsField) })]

function jumpTo(view: EditorView, h: Heading) {
	view.dispatch({ selection: { anchor: h.from }, effects: EditorView.scrollIntoView(h.from, { y: 'start' }) })
	view.focus()
}
```

**Breaking:** `useDocumentUtils().getTableOfContents(text)` now returns the same `Heading[]` (with `from` instead of `node: SyntaxNode`), and the `TocEntry` type is gone. Headings inside quotes and lists are no longer included, and closing `#`s are dropped from `text`.

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
- **Block commands:** `setLinePrefix(prefix)`, `insertBlock(before, after?)`, `blockInsertion(state, pos, before, after?)` (the same insertion as a transaction spec), `moveBlock(block, dir)`, `moveBlockTo(block, target, side)`, `deleteBlock(block)`
- **Queries:** `markAt`, `linkAt`, `wikilinkAt`, `formattableRange`, `blockAt`, `dropTarget`, `canMoveBlock`, `headings`, `headingAt`, `headingsOf(tree, doc)`
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
