# What's new in 0.3 (since 0.2.3)

0.3 adds an extension system and a set of ready-made extensions built on it: a selection toolbar, a slash menu, a block drag handle, and an AI assistant. **All of them are opt-in.** Until you pass `extensions`, the editor looks and behaves as it did in 0.2.3, apart from the two breaking changes below.

Full reference: the README's [Extensions](./README.md#extensions) section.

## Upgrade checklist

Two breaking changes. Everything else is additive.

1. **`getTableOfContents()` returns a new shape.** `useDocumentUtils().getTableOfContents(text)` now returns `Heading[]`, where each entry is `{ level, text, from }`.
   - `from` (the heading's position) replaces `node: SyntaxNode`.
   - The `TocEntry` type is removed; import `type Heading` from `@type32/codemirror-rich-obsidian-editor/kit` instead.
   - Only top-level headings are listed now: headings inside quotes and lists are skipped.
   - Closing hashes are dropped from `text` (`## Title ##` → `Title`).
2. **The formatting shortcuts were rewritten.** `Mod-b`, `Mod-i`, `Mod-Shift-x` and `Mod-Shift-h` now read the syntax tree instead of looking at the characters around the selection:
   - They remove a mark only when that mark wraps the selection exactly, so a stray `**` elsewhere on the line is no longer mistaken for one.
   - With no selection, they act on the word under the cursor, or insert an empty pair with the cursor inside.
   - Every cursor is handled when there are several.

## The `extensions` prop

`<Editor>` takes CodeMirror extensions. The prop is reactive: change the array and the editor reconfigures in place, without remounting or losing state. `[]` is an empty extension, so switching one off is a ternary:

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

## New entry points

| Import | What it is |
|---|---|
| `@type32/codemirror-rich-obsidian-editor/ext` | The ready-made extensions below. |
| `@type32/codemirror-rich-obsidian-editor/ext/ai` | The AI assistant (client). Needs optional peers, see below. |
| `@type32/codemirror-rich-obsidian-editor/ext/ai/tools` | AI tool definitions for your server routes. |
| `@type32/codemirror-rich-obsidian-editor/kit` | The API the ready-made extensions are built on: actions, commands, queries, overlays, block moves, headings. |

## Ready-made extensions

- **Selection toolbar:** `selectionToolbar()`. Formatting buttons above a selection inside one paragraph or heading: bold, italic, strikethrough, highlight, link and wikilink.
  - Configure it with `items`.
  - Other extensions can add buttons with `toolbarItems.of([...])`.
  - [Docs](./README.md#selection-toolbar)
- **Slash menu:** `slashMenu()`. Type `/` at the start of a line or after a space to insert text, headings, lists, a quote, callout, code, math, a table or a divider.
  - The list filters as you type; arrow keys select, Enter or Tab runs, Escape closes.
  - Other extensions can add items with `slashItems.of([...])`.
  - [Docs](./README.md#slash-menu)
- **Block drag handle:** `blockDragHandle()`. Drag whole blocks: paragraphs, code, tables, quotes, callouts, and list items together with their children.
  - Ordered lists are renumbered, and every move is a single undo step.
  - Clicking the handle opens Move up, Move down and Delete.
  - [Docs](./README.md#block-drag-handle)
- **AI assistant:** `aiAssistant()` from `/ext/ai`. AI that only proposes; nothing is written until you accept.
  - It opens only when invoked: an "Ask AI" toolbar button, AI items in the slash menu, or `Mod-j`.
  - Every result appears in a floating preview with a word diff. You can edit or refine it, then Accept (one undo step, tagged `userEvent: 'input.ai'`) or Discard.
  - [Docs](./README.md#ai-assistant)
- **Table of contents (data only):** `headingsField`, `headings(state)` and `headingAt(state, pos)` from `/kit`. This is the outline for your own sidebar; there's no built-in UI. [Docs](./README.md#table-of-contents)

### Setting up the AI assistant

1. Install the optional peers: `bun add ai @ai-sdk/vue @ai-sdk/openai-compatible`.
2. Point it at any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, OpenRouter, OpenAI, and so on). There are two modes:
   - **Server (recommended; the key stays on the server).** Set the endpoint in `nuxt.config`:
     ```ts
     cmOfmEditor: { ai: { baseURL: 'http://localhost:11434/v1', model: 'llama3.2' } } // + apiKey?, headers?
     ```
     - Override any field per environment with `NUXT_CM_OFM_EDITOR_AI_BASE_URL`, `_MODEL` or `_API_KEY`.
     - The module serves `POST /api/_cm-editor/ai`, which `aiAssistant()` uses by default.
     - That route is public like any API route, so put your auth middleware in front of it. If you'd rather serve your own, set `ai.route: false` and pass its path as `aiAssistant({ api })`.
   - **Browser:** `aiAssistant({ endpoint: { baseURL, model, apiKey? } })`. The browser calls the endpoint directly.
     - Anyone using the page can read the key, so use this for local models or keys your users enter themselves.
     - The endpoint must allow your page's origin (CORS).
3. **Optional: a chat in your app that edits the document.** Pass `editorTools` (from `/ext/ai/tools`) to `streamText` in your chat route, and use the auto-imported `useEditorAiModel()` as the model. In the browser, hand tool calls to `runEditorTool`. Edits appear in the same preview and wait for the user's decision; the model is told whether they were accepted. [Wiring](./README.md#chat)

If the peers are missing, nothing breaks:
- `aiAssistant()` logs a warning and adds nothing.
- `editorTools` is empty.
- `useEditorAiModel()` returns a 503 that names the missing packages.
- The module warns at build time when `cmOfmEditor.ai` is set.

## Writing your own extensions

The ready-made extensions use only what `/kit` exports, so anything they do, your extension can do. The main pieces:
- `EditorAction` (`{ id, label, icon?, kbds?, keywords?, color?, run?, panel?, isActive?, isEnabled? }`), the item type shared by toolbars and menus.
- `defineItemsFacet()`, to create your own contribution point like `toolbarItems` or `slashItems`.
- `vueOverlay(Component)`, which mounts a Vue component once per editor and gives it a reactive `editor` prop.
- Commands: `toggleMark`, `setLink`, `setLinePrefix`, `insertBlock`, `moveBlock`, and others.
- Queries: `markAt`, `linkAt`, `blockAt`, `headingAt`, and others.

Two rules keep an extension hot-pluggable:
- **Create plugins at module level.** If a `vueOverlay(...)` or `ViewPlugin` is created inside a `computed`, it remounts on every change.
- **Pass per-use options through a facet.**

Example and full list: [Writing your own](./README.md#writing-your-own).

## Other changes

- **Vue components the editor mounts can now use your app's providers.** Embeds, special code blocks and table widgets render with the Editor's provide chain. So Nuxt UI components that need `<UApp>`, such as tooltips and toasts, work inside your `embedComponent` and code-block components.
- **New dependency:** `diff`, used for the AI preview's word diff.
- **New optional peer dependencies:** `ai`, `@ai-sdk/vue` and `@ai-sdk/openai-compatible`, needed only for `/ext/ai`.

## Patch releases

- **0.3.1:** release only; no code changes.
- **0.3.2:** fix: the built-in AI route (`/api/_cm-editor/ai`) now builds its response with `createUIMessageStreamResponse`.
- **0.3.3:**
  - **Labels / localization:** `editorLabels` and `label(state, key, fallback)` from `/kit`. Every visible string of the toolbar, slash menu, block menu, link panel and AI panel can be replaced per key; missing keys stay English. [Docs](./README.md#labels--localization)
  - **AI endpoint:** `endpoint.fetch` (custom transport, e.g. through a desktop app's native side) and `endpoint.system` (system prompt).
  - `resolveActions(entries, state?)` applies the labels when given a state.
  - AI action ids changed to match their label keys: the "Ask AI" action is `askAi` (was `ai`), and slash preset items use the preset id (was `ai-<id>`).
