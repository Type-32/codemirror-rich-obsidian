import { Decoration, EditorView, keymap } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { Prec, type EditorState, type Line } from '@codemirror/state'
import { TableWidget, tableEntry } from '../codemirror-widgets/proseTableWidget'
import { contextMenuSize } from '../hostAppConfig'
import { parseTable } from '../../../utils/markdownTable'
import { sameVisualLine } from '../../utility/tools'
import { createProsePlugin } from './createProsePlugin'

/** The table starting (`starts`) or ending on `line`, if any. */
function tableOn(state: EditorState, line: Line, starts: boolean): { from: number, to: number } | null {
    let found: { from: number, to: number } | null = null
    syntaxTree(state).iterate({
        from: line.from, to: line.to,
        enter(node) {
            if (found) return false
            if (node.name !== 'Table') return
            if (state.doc.lineAt(starts ? node.from : node.to).number === line.number) found = { from: node.from, to: node.to }
            return false
        },
    })
    return found
}

/** The rendered table widget for the table at `from` (malformed tables aren't rendered). */
function widgetAt(view: EditorView, from: number): HTMLElement | undefined {
    return [...view.contentDOM.querySelectorAll<HTMLElement>('.cm-table-widget')].find(el => view.posAtDOM(el) === from)
}

/** ↓ on the line above a table / ↑ on the line below: into its first cell / its last row's first cell (Obsidian). */
function enterTable(view: EditorView, down: boolean): boolean {
    const sel = view.state.selection.main, doc = view.state.doc
    if (!sel.empty || !view.state.facet(EditorView.editable)) return false
    const line = doc.lineAt(sel.head)
    if (line.number === (down ? doc.lines : 1) || !sameVisualLine(view, sel.head, down ? line.to : line.from)) return false
    const table = tableOn(view.state, doc.line(line.number + (down ? 1 : -1)), down)
    const enter = table && tableEntry.get(widgetAt(view, table.from)!)
    if (!enter) return false
    enter(!down)
    return true
}

/** Backspace at the start of the line below a table selects the table (and the line break), as Obsidian does. */
function selectTableAbove(view: EditorView): boolean {
    const sel = view.state.selection.main, doc = view.state.doc
    const line = doc.lineAt(sel.head)
    if (!sel.empty || sel.head !== line.from || line.number === 1) return false
    const table = tableOn(view.state, doc.line(line.number - 1), false)
    if (!table || !widgetAt(view, table.from)) return false
    view.dispatch({ selection: { anchor: sel.head, head: table.from } })
    return true
}

/**
 * GFM tables always render as a table of editable cells (see `TableWidget`): the cursor never enters the source;
 * ↑/↓ from the lines around a table move into its cells. Malformed tables (no valid delimiter row) fall through to
 * plain text so the user can repair them.
 */
export const proseTablePlugin = [
    createProsePlugin({
        block: true,
        nodes: ['Table'],
        decorate(node, state, _active, out) {
            const source = state.doc.sliceString(node.from, node.to)
            const model = parseTable(source)
            if (!model) return false
            out.push(Decoration.replace({ widget: new TableWidget(model, source, state.facet(contextMenuSize)), block: true }).range(node.from, node.to))
            return false
        },
    }),
    // Above the standard keymap's cursor motion and deletion.
    Prec.high(keymap.of([
        { key: 'ArrowDown', run: v => enterTable(v, true) },
        { key: 'ArrowUp', run: v => enterTable(v, false) },
        { key: 'Backspace', run: selectTableAbove },
    ])),
]
