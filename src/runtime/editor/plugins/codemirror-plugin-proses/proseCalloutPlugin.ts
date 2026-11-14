import { Decoration } from '@codemirror/view'
import { CalloutWidget, parseCallout } from '../codemirror-widgets/proseCalloutWidget'
import { selectionTouches } from '../../utility/tools'
import { createProsePlugin } from './createProsePlugin'

/**
 * Replaces a callout blockquote (`> [!type] title`, `[!type]` opening its first line) with a rendered widget while
 * the selection is outside it. Nested quotes and callouts render inside the widget (its body is a nested editor);
 * a callout inside a list item renders as a callout too. The widget covers whole lines.
 */
export const proseCalloutPlugin = createProsePlugin({
    block: true,
    nodes: ['Blockquote'],
    decorate(node, state, _active, out) {
        const bq = node.node
        if (bq.parent?.name === 'Blockquote') return false
        const marker = bq.getChild('Paragraph')?.getChild('Callout')
        if (!marker || state.doc.lineAt(marker.from).number !== state.doc.lineAt(bq.from).number) return false
        const from = state.doc.lineAt(node.from).from
        if (selectionTouches(state, from, node.to)) return false
        const source = state.doc.sliceString(from, node.to)
        const callout = parseCallout(source)
        if (!callout) return false
        out.push(Decoration.replace({ widget: new CalloutWidget(source, callout), block: true }).range(from, node.to))
        return false
    },
})
