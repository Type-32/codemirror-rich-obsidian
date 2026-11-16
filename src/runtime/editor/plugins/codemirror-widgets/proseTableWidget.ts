import { WidgetType, type EditorView } from '@codemirror/view'
import type { TableModel } from '../../../utils/markdownTable'
import type { MenuSize } from '../hostAppConfig'
import { sameInputs } from '../../utility/nestedEditor'
import { tableRenderer, type Mounted, type RenderedTable } from '../renderers'

/** The mounted table of each widget DOM, and the inputs its cells were built with. */
const tables = new WeakMap<HTMLElement, { mounted: Mounted<RenderedTable>, inputs: readonly unknown[] }>()

/**
 * Moves focus from the document into a rendered table: its first cell, or its last row's first cell `fromBelow`.
 * The table's renderer registers this for its widget's element.
 */
export const tableEntry = new WeakMap<HTMLElement, (fromBelow: boolean) => void>()

/**
 * A GFM table drawn by `tableRenderer` (in `/vue`: a grid of cells, each a nested editor). Any widget of this type
 * updates the mounted table in place (`updateDOM`), so the cell being edited keeps focus while each keystroke rewrites
 * the source; a change in what the cells take from the editor (`nestedInputs`: mappings, labels, the editor turning
 * read-only) rebuilds it instead.
 */
export class TableWidget extends WidgetType {
    constructor(readonly model: TableModel, readonly source: string, readonly menuSize: MenuSize | undefined, readonly inputs: readonly unknown[]) {
        super()
    }

    override eq(other: TableWidget) {
        return other.source === this.source && other.menuSize === this.menuSize && sameInputs(other.inputs, this.inputs)
    }

    toDOM(view: EditorView) {
        const el = document.createElement('div')
        el.className = 'cm-table-widget'
        el.contentEditable = 'false'
        const mounted = view.state.facet(tableRenderer)!(view, el, { model: this.model, source: this.source, menuSize: this.menuSize })
        tables.set(el, { mounted, inputs: this.inputs })
        return el
    }

    override updateDOM(dom: HTMLElement) {
        const table = tables.get(dom)
        if (!table || !sameInputs(table.inputs, this.inputs)) return false
        table.mounted.update({ model: this.model, source: this.source, menuSize: this.menuSize })
        return true
    }

    override destroy(dom: HTMLElement) {
        tables.get(dom)?.mounted.destroy()
        tables.delete(dom)
    }

    override ignoreEvent(event: Event) {
        // Everything inside the grid is the widget's; a press on its margin places the editor's cursor.
        return !(event instanceof MouseEvent && event.type === 'mousedown' && !(event.target as Element).closest('.cm-table-editor'))
    }
}
