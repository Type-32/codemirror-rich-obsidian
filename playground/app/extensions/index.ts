// User-land extensions: built only from the package's public `/kit` and `/ext` entry points.
import { vueOverlay } from '@type32/codemirror-rich-obsidian-editor/kit'
import { toolbarItems } from '@type32/codemirror-rich-obsidian-editor/ext'
import WordCount from './WordCount.vue'

/** Adds an "Uppercase" button to the default selection toolbar via its contribution facet. */
export const uppercaseButton = toolbarItems.of([{
    id: 'uppercase',
    label: 'Uppercase',
    icon: 'i-lucide-case-upper',
    run: (view) => {
        const { from, to } = view.state.selection.main
        view.dispatch({ changes: { from, to, insert: view.state.sliceDoc(from, to).toUpperCase() }, selection: { anchor: from, head: to } })
    },
}])

/** Word-count badge; module-level so toggling other extensions never remounts it. */
export const wordCount = vueOverlay(WordCount)
