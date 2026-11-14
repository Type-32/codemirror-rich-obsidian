import { Decoration } from '@codemirror/view'
import type { EditorState } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import { CalloutWidget, parseCallout } from '../codemirror-widgets/proseCalloutWidget'
import { selectionTouches } from '../../utility/tools'
import { createProsePlugin } from './createProsePlugin'

/**
 * The range a top-level blockquote is rendered over as a callout widget (whole lines), or null when it shows as
 * source: not a callout (`[!type]` must open its first line), or the selection touches it. Plugins decorating nodes
 * inside a callout skip them while it renders; the widget's nested editor renders them instead.
 */
export function renderedCallout(state: EditorState, bq: SyntaxNode): { from: number, to: number } | null {
    if (bq.parent?.name === 'Blockquote') return null
    const marker = bq.getChild('Paragraph')?.getChild('Callout')
    if (!marker || state.doc.lineAt(marker.from).number !== state.doc.lineAt(bq.from).number) return null
    const from = state.doc.lineAt(bq.from).from
    return selectionTouches(state, from, bq.to) ? null : { from, to: bq.to }
}

/**
 * Replaces a callout blockquote (`> [!type] title`, `[!type]` opening its first line) with a rendered widget while
 * the selection is outside it. Nested quotes and callouts render inside the widget (its body is a nested editor);
 * a callout inside a list item renders as a callout too. The widget covers whole lines.
 */
export const proseCalloutPlugin = createProsePlugin({
    block: true,
    nodes: ['Blockquote'],
    decorate(node, state, _active, out) {
        const range = renderedCallout(state, node.node)
        if (!range) return false
        const source = state.doc.sliceString(range.from, range.to)
        const callout = parseCallout(source)
        if (!callout) return false
        out.push(Decoration.replace({ widget: new CalloutWidget(source, callout), block: true }).range(range.from, range.to))
        return false
    },
})
