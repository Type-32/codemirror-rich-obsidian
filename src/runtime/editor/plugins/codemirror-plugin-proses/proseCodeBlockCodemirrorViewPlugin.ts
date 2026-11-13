import { Decoration } from '@codemirror/view'
import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { EndFenceWidget, LanguageFlairWidget } from '../codemirror-widgets/proseCodeBlockWidgets'
import { ProseVueComponentEmbedWidget } from '../codemirror-widgets/proseVueComponentEmbedWidget'
import { specialCodeBlockMapFacet } from '../specialCodeBlockMappingConfig'
import { createProsePlugin } from './createProsePlugin'

const lineBegin = Decoration.line({ attributes: { class: 'cm-codeblock cm-line-codeblock-begin' } })
const lineContent = Decoration.line({ attributes: { class: 'cm-codeblock cm-line-codeblock-content' } })
const lineEnd = Decoration.line({ attributes: { class: 'cm-codeblock cm-line-codeblock-end' } })

/** The flair text for a fence's info string: the language's name, the raw first word if unknown, '' for none. */
export function codeBlockLabel(info: string) {
    const lang = /^\S*/.exec(info)![0]
    return lang ? LanguageDescription.matchLanguageName(languages, lang, true)?.name ?? lang : ''
}

/**
 * Fenced code, Obsidian's way. Code lines stay in the contentDOM (native editing). While the selection is outside the
 * block, the opening fence becomes a language flair / copy button and the closing fence disappears; a cursor anywhere
 * inside reveals both fences. An unclosed fence is left as source. A `codeInfo` with a registered special component
 * (mermaid, bases, …) replaces the whole block with that component instead.
 */
export const proseCodeBlockPlugin = createProsePlugin({
    block: true,
    nodes: ['FencedCode'],
    reconfigureOn: [specialCodeBlockMapFacet],
    decorate(node, state, active, out) {
        const info = node.node.getChild('CodeInfo')
        const language = info ? state.doc.sliceString(info.from, info.to) : ''
        const marks = node.node.getChildren('CodeMark')
        const closed = marks.length > 1
        const first = state.doc.lineAt(node.from)
        const last = state.doc.lineAt(closed ? marks.at(-1)!.from : node.to)
        const bodyFrom = first.number + 1, bodyTo = closed ? last.number - 1 : last.number
        const code = bodyFrom <= bodyTo ? state.doc.sliceString(state.doc.line(bodyFrom).from, state.doc.line(bodyTo).to) : ''

        const special = closed && state.facet(specialCodeBlockMapFacet).find(m => m.codeInfo === language)
        if (special && !active) {
            out.push(Decoration.replace({
                widget: new ProseVueComponentEmbedWidget(special.component, { codeContent: code }, node.from, node.to),
                block: true,
            }).range(node.from, node.to))
            return false
        }

        for (let n = first.number; n <= last.number; n++) {
            const line = state.doc.line(n)
            if (n === first.number) out.push(lineBegin.range(line.from))
            else if (closed && n === last.number) out.push(lineEnd.range(line.from))
            else out.push(lineContent.range(line.from))
        }
        if (closed && !active) {
            out.push(Decoration.replace({ widget: new LanguageFlairWidget(codeBlockLabel(language), code) }).range(first.from, first.to))
            out.push(Decoration.replace({ widget: new EndFenceWidget() }).range(last.from, last.to))
        }
        return false
    },
})
