import { Decoration } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { CalloutWidget } from '../codemirror-widgets/proseCalloutWidget'
import { createProsePlugin } from './createProsePlugin'

/** Any Blockquote strictly inside `bq` (direct `> >` or via a list item). */
function hasNestedBlockquote(bq: SyntaxNode): boolean {
    let nested = false
    bq.cursor().iterate(n => {
        if (nested) return false
        if (n.name === 'Blockquote' && n.from !== bq.from) { nested = true; return false }
    })
    return nested
}

/**
 * Replaces a callout blockquote (`> [!type] title`) with a rendered widget while the selection
 * is outside it.
 *
 * Blockquotes containing a nested blockquote are left as source: markdown-it-obsidian-callouts
 * mis-renders nested callouts, and an atomic block replace over a mis-rendered region made the
 * user's recovery edits destructive (the README's "nested callouts lose data" issue). Those
 * fall through to proseQuoteblockPlugin's line styling instead.
 */
export const proseCalloutPlugin = createProsePlugin({
    block: true,
    nodes: ['Blockquote'],
    decorate(node, state, active, out) {
        const bq = node.node
        if (bq.parent?.name === 'Blockquote') return false
        if (active || !bq.getChild('Paragraph')?.getChild('Callout') || hasNestedBlockquote(bq)) return false
        out.push(Decoration.replace({
            widget: new CalloutWidget(state.doc.sliceString(node.from, node.to)),
            block: true,
        }).range(node.from, node.to))
        return false
    },
})
