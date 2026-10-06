import { Decoration } from '@codemirror/view'
import { BlockLatexWidget, InlineLatexWidget } from '../codemirror-widgets/proseLatexWidgets'
import { createProsePlugin } from './createProsePlugin'

const hiddenSource = Decoration.mark({ class: 'cm-hidden-latex' })

/** `$x$` → inline KaTeX. Inline replace, so viewport-scoped. */
const latexInline = createProsePlugin({
    nodes: ['TexInline'],
    decorate(node, state, active, out) {
        if (active) return
        out.push(Decoration.replace({ widget: new InlineLatexWidget(state.doc.sliceString(node.from + 1, node.to - 1)) }).range(node.from, node.to))
    },
})

/**
 * `$$…$$` → display KaTeX. Multi-line blocks keep their source lines in the DOM (hidden via CSS)
 * and append a block widget after the last line: a block *replace* spanning lines would make
 * the lines unreachable for cursor movement.
 */
const latexBlock = createProsePlugin({
    block: true,
    nodes: ['TexBlock'],
    decorate(node, state, active, out) {
        if (active) return
        const source = state.doc.sliceString(node.from + 2, node.to - 2)
        const widget = new BlockLatexWidget(source)
        if (source.includes('\n')) {
            out.push(hiddenSource.range(node.from, node.to))
            out.push(Decoration.widget({ widget, block: true, side: 1 }).range(state.doc.lineAt(node.to).to))
        } else {
            out.push(Decoration.replace({ widget }).range(node.from, node.to))
        }
    },
})

export const proseLatexPlugin = [latexInline, latexBlock]
