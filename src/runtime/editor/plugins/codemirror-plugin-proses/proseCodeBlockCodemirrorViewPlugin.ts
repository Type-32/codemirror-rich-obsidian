import { Decoration } from '@codemirror/view'
import { EndFenceWidget, LanguageFlairWidget } from '../codemirror-widgets/proseCodeBlockWidgets'
import { ProseVueComponentEmbedWidget } from '../codemirror-widgets/proseVueComponentEmbedWidget'
import { specialCodeBlockMapFacet } from '../specialCodeBlockMappingConfig'
import { selectionTouches } from '../../utility/tools'
import { createProsePlugin } from './createProsePlugin'

const lineBegin = Decoration.line({ attributes: { class: 'cm-codeblock cm-line-codeblock-begin' } })
const lineContent = Decoration.line({ attributes: { class: 'cm-codeblock cm-line-codeblock-content' } })
const lineEnd = Decoration.line({ attributes: { class: 'cm-codeblock cm-line-codeblock-end' } })

/**
 * Fenced code. Code lines stay in the contentDOM (native editing, no widget round-trip); only the
 * two fence lines are replaced — the opening one by a language flair / copy button — and each
 * fence is revealed while the selection touches *its own line*. A `codeInfo` with a registered
 * special component (mermaid, bases, …) replaces the whole block with that component instead.
 */
export const proseCodeBlockPlugin = createProsePlugin({
    block: true,
    nodes: ['FencedCode'],
    reconfigureOn: [specialCodeBlockMapFacet],
    decorate(node, state, active, out) {
        const info = node.node.getChild('CodeInfo')
        const language = info ? state.doc.sliceString(info.from, info.to) : ''
        const first = state.doc.lineAt(node.from)
        // The node may end with trailing whitespace/newlines after the closing fence.
        let end = node.to
        while (end > node.from && /\s/.test(state.doc.sliceString(end - 1, end))) end--
        const last = state.doc.lineAt(end)
        const code = last.number - first.number >= 2
            ? state.doc.sliceString(state.doc.line(first.number + 1).from, state.doc.line(last.number - 1).to)
            : ''

        const special = state.facet(specialCodeBlockMapFacet).find(m => m.codeInfo === language)
        if (special && !active) {
            out.push(Decoration.replace({
                widget: new ProseVueComponentEmbedWidget(special.component, { codeContent: code }, node.from, node.to),
                block: true,
            }).range(node.from, node.to))
            return false
        }

        for (let n = first.number; n <= last.number; n++) {
            const line = state.doc.line(n)
            if (n === first.number) {
                out.push(lineBegin.range(line.from))
                if (!selectionTouches(state, line.from, line.to))
                    out.push(Decoration.replace({ widget: new LanguageFlairWidget(language, code) }).range(line.from, line.to))
            } else if (n === last.number) {
                out.push(lineEnd.range(line.from))
                if (!selectionTouches(state, line.from, line.to))
                    out.push(Decoration.replace({ widget: new EndFenceWidget() }).range(line.from, line.to))
            } else {
                out.push(lineContent.range(line.from))
            }
        }
        return false
    },
})
