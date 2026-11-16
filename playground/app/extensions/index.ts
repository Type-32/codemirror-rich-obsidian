// User-land extensions: built only from the package's public entry points.
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'
import { LanguageDescription, syntaxTree } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import type { MarkdownConfig } from '@lezer/markdown'
import { nestedExtensions, type MarkdownOptions } from '@type32/codemirror-rich-obsidian-editor'
import { vueOverlay } from '@type32/codemirror-rich-obsidian-editor/kit'
import { toolbarItems } from '@type32/codemirror-rich-obsidian-editor/ext'
import WordCount from './WordCount.vue'

/** `{{name}}`: a template variable, as host Markdown syntax (`<Editor :markdown>`). */
const variableSyntax: MarkdownConfig = {
    defineNodes: [{ name: 'Variable' }],
    parseInline: [{
        name: 'Variable',
        parse(cx, next, pos) {
            if (next !== 123 /* { */ || cx.char(pos + 1) !== 123) return -1
            const end = cx.slice(pos, cx.end).indexOf('}}')
            return end > 2 ? cx.addElement(cx.elt('Variable', pos, pos + end + 2)) : -1
        },
    }],
}

/** A `dataview` fence highlighted as SQL, labelled "Dataview". */
const dataview = LanguageDescription.of({ name: 'Dataview', alias: ['dataview'], load: () => languages.find(l => l.name === 'SQL')!.load() })

/** Module-level: the editor reparses when it gets a different object. */
export const markdownOptions: MarkdownOptions = { extensions: [variableSyntax], codeLanguages: [...languages, dataview] }

const variableMark = Decoration.mark({ class: 'pg-variable' })

/** Highlights `Variable` nodes, in the note and (through `nestedExtensions`) in callouts and table cells. */
const variableHighlight = ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) {
        this.decorations = this.build(view)
    }

    update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) this.decorations = this.build(u.view)
    }

    build(view: EditorView) {
        const out = new RangeSetBuilder<Decoration>()
        for (const { from, to } of view.visibleRanges) {
            syntaxTree(view.state).iterate({ from, to, enter: (n) => { if (n.name === 'Variable') out.add(n.from, n.to, variableMark) } })
        }
        return out.finish()
    }
}, { decorations: v => v.decorations })

export const variables = [variableHighlight, nestedExtensions.of(variableHighlight)]

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
