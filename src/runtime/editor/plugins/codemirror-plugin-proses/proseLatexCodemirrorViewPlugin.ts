import { Decoration } from '@codemirror/view'
import type { EditorState, Range } from '@codemirror/state'
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { BlockLatexWidget, InlineLatexWidget } from '../codemirror-widgets/proseLatexWidgets'
import { createProsePlugin } from './createProsePlugin'
import { renderedCallout } from './proseCalloutPlugin'

const hiddenSource = Decoration.mark({ class: 'cm-hidden-latex' })

/** Inside a callout that renders as a widget: its nested editor draws the math, so this editor must not. */
function inRenderedCallout(state: EditorState, node: SyntaxNode): boolean {
    for (let n = node.parent; n; n = n.parent) {
        if (n.name === 'Blockquote' && n.parent?.name !== 'Blockquote') return renderedCallout(state, n) !== null
    }
    return false
}

function quoteDepth(node: SyntaxNode): number {
    let depth = 0
    for (let n = node.parent; n; n = n.parent) if (n.name === 'Blockquote') depth++
    return depth
}

/** The TeX between `$$` and `$$`, without the `>` markers of the quotes it sits in (lazy lines have none). */
export function texBlockSource(state: EditorState, node: SyntaxNode): string {
    const depth = quoteDepth(node)
    const source = state.doc.sliceString(node.from + 2, node.to - 2)
    if (!depth) return source
    const markers = new RegExp(`^(?:[ \\t]{0,3}> ?){0,${depth}}`)
    return source.split('\n').map((line, i) => i ? line.replace(markers, '') : line).join('\n')
}

/** `$x$` → inline KaTeX. Inline replace, so viewport-scoped. */
const latexInline = createProsePlugin({
    nodes: ['TexInline'],
    decorate(node, state, active, out) {
        if (active || inRenderedCallout(state, node.node)) return
        out.push(Decoration.replace({ widget: new InlineLatexWidget(state.doc.sliceString(node.from + 1, node.to - 1)) }).range(node.from, node.to))
    },
})

/**
 * `$$…$$` → display KaTeX. Multi-line blocks keep their source lines in the DOM (hidden via CSS)
 * and append a block widget after the last line: a block *replace* spanning lines would make
 * the lines unreachable for cursor movement. Inside a quote the math replaces its source inline instead (a state
 * field may replace line breaks), so it renders on the quote's first math line, inside the quote's styling.
 */
const latexBlock = createProsePlugin({
    block: true,
    nodes: ['TexBlock'],
    decorate(node, state, active, out) {
        if (active || inRenderedCallout(state, node.node)) return
        const source = texBlockSource(state, node.node)
        const widget = new BlockLatexWidget(source)
        if (source.includes('\n') && !quoteDepth(node.node)) {
            out.push(hiddenSource.range(node.from, node.to))
            out.push(Decoration.widget({ widget, block: true, side: 1 }).range(state.doc.lineAt(node.to).to))
        } else {
            out.push(Decoration.replace({ widget }).range(node.from, node.to))
        }
    },
})

/** TeX token classes, sharing the code palette (`--code-*`) like Obsidian's math source highlighting. */
const TEX_TOKEN = /(\\[a-zA-Z@]+\*?|\\.)|([_^&])|([{}[\]()])|(\d+(?:\.\d+)?)|((?<!\\)%.*)/g
const texMarks = ['cm-code-keyword', 'cm-code-operator', 'cm-code-punctuation', 'cm-code-value', 'cm-code-comment'].map(c => Decoration.mark({ class: c }))

/** Highlight ranges for TeX `text` starting at `offset`: commands, `_ ^ &`, brackets, numbers, `%` comments. */
export function texTokens(text: string, offset: number): Range<Decoration>[] {
    const out: Range<Decoration>[] = []
    for (const m of text.matchAll(TEX_TOKEN)) {
        const kind = m.slice(1).findIndex(Boolean)
        out.push(texMarks[kind]!.range(offset + m.index, offset + m.index + m[0].length))
    }
    return out
}

/** Math shown as source (cursor in it) is highlighted, between its `$`/`$$` markers. */
const latexSource = createProsePlugin({
    nodes: ['TexBlock', 'TexInline'],
    decorate(node: SyntaxNodeRef, state, active, out) {
        if (!active) return
        const marker = node.name === 'TexBlock' ? 2 : 1
        const end = node.to - marker > node.from + marker ? node.to - marker : node.to
        out.push(...texTokens(state.doc.sliceString(node.from + marker, end), node.from + marker))
    },
})

export const proseLatexPlugin = [latexInline, latexBlock, latexSource]
