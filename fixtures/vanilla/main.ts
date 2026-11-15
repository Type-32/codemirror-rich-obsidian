// The editor in a plain CodeMirror setup: no Vue, no Nuxt, no Tailwind. `bunx vite fixtures/vanilla` (after `bun run prepack`).
import 'katex/dist/katex.min.css'
import '@type32/codemirror-rich-obsidian-editor/editor.css'
import { EditorState } from '@codemirror/state'
import { EditorView, drawSelection, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { internalLinkMapFacet, specialCodeBlockMapFacet, wysiwyg, type EmbedMount } from '@type32/codemirror-rich-obsidian-editor'

const counter: EmbedMount = (el, { codeContent }) => {
    el.textContent = `A code block drawn by a mount function: ${String(codeContent).length} characters`
}

const doc = `---
status: draft
---
# CodeMirror only

Some **bold**, ==highlighted== and \`inline code\` text, a [[My Note]] link, a #tag and $e^{i\\pi} + 1 = 0$.

- [ ] a task
- [x] a done task

> [!tip] A callout
> With **markdown** inside.

| a | b |
| - | - |
| c | d |

\`\`\`js
const answer = 42
\`\`\`

\`\`\`count
four words in here
\`\`\`
`

const view = new EditorView({
    parent: document.querySelector('#editor')!,
    state: EditorState.create({
        doc,
        extensions: [
            history(),
            drawSelection(),
            keymap.of([...defaultKeymap, ...historyKeymap]),
            EditorView.lineWrapping,
            wysiwyg(),
            internalLinkMapFacet.of([{ name: 'My Note', referenceId: 'my-note' }]),
            specialCodeBlockMapFacet.of([{ codeInfo: 'count', mount: counter }]),
        ],
    }),
})
Object.assign(window, { view })
