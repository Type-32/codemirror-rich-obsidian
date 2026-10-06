import { Decoration } from '@codemirror/view'
import { selectionTouches } from '../../utility/tools'
import { createProsePlugin } from './createProsePlugin'

const quoteMark = Decoration.mark({ class: 'cm-formatting cm-formatting-quote cm-meta' })
const quoteMarkActive = Decoration.mark({ class: 'cm-formatting cm-formatting-quote cm-meta cm-formatting-quote-active' })
const quoteText = Decoration.mark({ class: 'cm-quote' })
const lineDeco: Record<string, Decoration> = {}
for (const pos of ['single', 'start', 'middle', 'end'])
    lineDeco[pos] = Decoration.line({ attributes: { class: `cm-quoteblock cm-quoteblock-${pos}` } })

/**
 * Line classes for blockquotes (start/middle/end for the bar styling) and a mark on each `>`
 * so it can be dimmed or shown active. Callout blockquotes are replaced by proseCalloutPlugin;
 * when they're not (cursor inside / nested) this styling is what the user sees.
 */
export const proseQuoteblockPlugin = createProsePlugin({
    nodes: ['Blockquote'],
    decorate(node, state, _active, out) {
        if (node.node.parent?.name === 'Blockquote') return false // outer pass styles all lines once
        const first = state.doc.lineAt(node.from).number, last = state.doc.lineAt(node.to).number
        for (let n = first; n <= last; n++) {
            const line = state.doc.line(n)
            const pos = first === last ? 'single' : n === first ? 'start' : n === last ? 'end' : 'middle'
            out.push(lineDeco[pos]!.range(line.from))
            const m = /^\s*(>\s*)+/.exec(line.text)
            if (!m) continue
            const markEnd = line.from + m[0].length
            out.push((selectionTouches(state, line.from, line.to) ? quoteMarkActive : quoteMark).range(line.from, markEnd))
            if (markEnd < line.to) out.push(quoteText.range(markEnd, line.to))
        }
        return false
    },
})
