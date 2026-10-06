import { Decoration } from '@codemirror/view'
import { TableWidget } from '../codemirror-widgets/proseTableWidget'
import { parseTable } from '../../../utils/markdownTable'
import { createProsePlugin } from './createProsePlugin'

/**
 * GFM tables always render as an editable widget: the cursor never enters the source and all
 * edits go through the widget (cells, rows, columns, alignment). Malformed tables (no valid
 * delimiter row) fall through to plain text so the user can repair them.
 */
export const proseTablePlugin = createProsePlugin({
    block: true,
    nodes: ['Table'],
    decorate(node, state, _active, out) {
        const source = state.doc.sliceString(node.from, node.to)
        const model = parseTable(source)
        if (!model) return false
        out.push(Decoration.replace({ widget: new TableWidget(model, source), block: true }).range(node.from, node.to))
        return false
    },
})
