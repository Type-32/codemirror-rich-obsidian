import { WidgetType, type EditorView } from '@codemirror/view'
import { markRaw, shallowRef, type ShallowRef } from 'vue'
import TableEditor from '../../../components/Editor/TableEditor.vue'
import { mountVueComponent } from '../../../kit/vue'
import type { TableModel } from '../../../utils/markdownTable'
import type { MenuSize } from '../hostAppConfig'

export interface RenderedTable {
    model: TableModel
    /** The table's markdown, exactly as in the document. */
    source: string
    /** The editor's `contextMenuSize`. */
    menuSize: MenuSize | undefined
}

/** The mounted editor of each table widget DOM: its table ref (updated in place) and unmount. */
const tables = new WeakMap<HTMLElement, { table: ShallowRef<RenderedTable>, unmount: () => void }>()

/** Moves focus from the document into a rendered table: its first cell, or its last row's first cell `fromBelow`. */
export const tableEntry = new WeakMap<HTMLElement, (fromBelow: boolean) => void>()

/**
 * A GFM table rendered as a grid of cells, each a nested editor (live preview while you type in it, rendered
 * otherwise); typing writes through to the cell's text in the source. Rows/columns/alignment go through the context
 * menu and drag handles. Any widget of this type updates the mounted grid in place (`updateDOM`), so the cell being
 * edited keeps focus while each keystroke rewrites the source.
 */
export class TableWidget extends WidgetType {
    constructor(readonly model: TableModel, readonly source: string, readonly menuSize: MenuSize | undefined) {
        super()
    }

    override eq(other: TableWidget) {
        return other.source === this.source && other.menuSize === this.menuSize
    }

    toDOM(view: EditorView) {
        const el = document.createElement('div')
        el.className = 'cm-table-widget'
        el.contentEditable = 'false'
        const table = shallowRef<RenderedTable>({ model: this.model, source: this.source, menuSize: this.menuSize })
        const register = (enter: (fromBelow: boolean) => void) => tableEntry.set(el, enter)
        tables.set(el, { table, unmount: mountVueComponent(view, el, TableEditor, { view: markRaw(view), table, register }) })
        return el
    }

    override updateDOM(dom: HTMLElement) {
        const mounted = tables.get(dom)
        if (!mounted) return false
        mounted.table.value = { model: this.model, source: this.source, menuSize: this.menuSize }
        return true
    }

    override destroy(dom: HTMLElement) {
        tables.get(dom)?.unmount()
        tables.delete(dom)
    }

    override ignoreEvent(event: Event) {
        // Everything inside the grid is the widget's; a press on its margin places the editor's cursor.
        return !(event instanceof MouseEvent && event.type === 'mousedown' && !(event.target as Element).closest('.cm-table-editor'))
    }
}
