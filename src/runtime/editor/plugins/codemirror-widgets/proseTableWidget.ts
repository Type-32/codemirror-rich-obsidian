import { WidgetType, type EditorView } from '@codemirror/view'
import TableEditor from '../../../components/Editor/TableEditor.vue'
import { mountVueComponent } from '../../../kit/vue'
import { serializeTable, type TableModel } from '../../../utils/markdownTable'

/**
 * Renders a GFM table as an editable grid (cells, row/col insert/delete/reorder, alignment via
 * context menu). All mutations go model → `serializeTable` → one change over the table's doc
 * range; the markdown source is never exposed to the user.
 */
export class TableWidget extends WidgetType {
    private unmount: (() => void) | null = null

    constructor(readonly model: TableModel, readonly source: string) {
        super()
    }

    override eq(other: TableWidget) {
        return other.source === this.source
    }

    toDOM(view: EditorView) {
        const container = document.createElement('div')
        container.className = 'cm-table-widget'
        container.contentEditable = 'false'

        const commit = (next: TableModel) => {
            // Widget offsets are stale after any edit: re-resolve the table's range from the DOM.
            const from = view.posAtDOM(container)
            view.dispatch({ changes: { from, to: from + this.source.length, insert: serializeTable(next) } })
        }
        this.unmount = mountVueComponent(view, container, TableEditor, { model: this.model, commit })
        return container
    }

    override destroy() {
        this.unmount?.()
        this.unmount = null
    }

    override ignoreEvent(event: Event) {
        // Native drag/drop, context menu, and cell editing all live inside; let the widget own them.
        return !(event instanceof MouseEvent && event.type === 'mousedown' && !(event.target as Element).closest('.cm-table-editor'))
    }
}
