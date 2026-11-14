import { Annotation, EditorSelection, EditorState, Prec, Transaction, type Extension, type StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, keymap, type DecorationSet } from '@codemirror/view'
import { PropertiesWidget } from '../codemirror-widgets/propertiesWidget'
import { contextMenuSize } from '../hostAppConfig'
import { propertiesOptions } from '../propertiesConfig'
import { propertiesYaml } from '../../utility/properties'
import type { PropertiesOptions } from '../../types/editor-types'
import { createProsePlugin } from './createProsePlugin'

/** The panel over the frontmatter, when its YAML is a mapping Obsidian would show; invalid YAML stays as source. */
const panelField = createProsePlugin({
    block: true,
    nodes: ['YAMLFrontMatter'],
    decorate(node, state, _active, out) {
        if (node.from !== 0) return false
        const yaml = propertiesYaml(state.doc.sliceString(node.from, node.to))
        if (yaml !== null) out.push(Decoration.replace({ widget: new PropertiesWidget(yaml, state.facet(contextMenuSize)), block: true }).range(0, node.to))
        return false
    },
}) as StateField<DecorationSet>

/** End of the frontmatter while the panel replaces it, or null. */
export function panelEnd(state: EditorState): number | null {
    let end: number | null = null
    state.field(panelField, false)?.between(0, 0, (_from, to) => {
        end = to
    })
    return end
}

const bodyStart = (state: EditorState, end: number) => Math.min(end + 1, state.doc.length)

/**
 * Typing, deleting and pasting can't touch the frontmatter behind the panel (nor the line break after it), so
 * Backspace at the start of the body or select-all + delete keep it. A user edit inserting before the panel is dropped
 * whole (a suppressed range doesn't cover insertions at its edge). The panel's own edits, undo/redo and programmatic
 * changes carry no user event and pass.
 */
const protectFrontmatter = EditorState.changeFilter.of((tr) => {
    const end = panelEnd(tr.startState)
    if (end === null || !tr.annotation(Transaction.userEvent) || tr.isUserEvent('undo') || tr.isUserEvent('redo')) return true
    let atStart = false
    tr.changes.iterChanges((fromA, toA) => { if (fromA === 0 && toA === 0) atStart = true })
    return atStart ? false : [0, Math.min(end + 1, tr.startState.doc.length)]
})

const startedProperties = Annotation.define<true>()

/**
 * Typing the third `-` of a first line `---` in a note without properties gives it empty ones and opens "Add
 * property", as in Obsidian (`---` → `---\n\n---`, so the panel shows).
 */
const startProperties = [
    EditorState.transactionFilter.of((tr) => {
        if (!tr.isUserEvent('input.type') || panelEnd(tr.startState) !== null) return tr
        if (tr.startState.doc.line(1).text !== '--' || tr.newDoc.line(1).text !== '---') return tr
        const end = tr.newDoc.line(1).to
        return [tr, { changes: { from: end, insert: end === tr.newDoc.length ? '\n\n---\n' : '\n\n---' }, annotations: startedProperties.of(true), sequential: true }]
    }),
    EditorView.updateListener.of((u) => {
        if (u.transactions.some(t => t.annotation(startedProperties))) u.view.dom.querySelector<HTMLElement>('.cm-properties-add')?.click()
    }),
]

/** The cursor never sits inside or before the panel: such selections move to the start of the body. */
const keepSelectionInBody = EditorState.transactionFilter.of((tr) => {
    const end = panelEnd(tr.state)
    if (end === null || tr.newSelection.ranges.every(r => r.from > end)) return tr
    const start = bodyStart(tr.state, end)
    const ranges = tr.newSelection.ranges.map(r => EditorSelection.range(Math.max(r.anchor, start), Math.max(r.head, start)))
    return [tr, { selection: EditorSelection.create(ranges, tr.newSelection.mainIndex), sequential: true }]
})

/** A document opened with the cursor at its start gets it moved below the panel. */
const initialSelection = ViewPlugin.define((view) => {
    const end = panelEnd(view.state)
    if (end !== null && view.state.selection.main.head <= end) {
        queueMicrotask(() => view.dispatch({ selection: { anchor: bodyStart(view.state, end) } }))
    }
    return {}
})

/** ArrowUp out of the first body line goes into the panel (its last row, "Add property"), as in Obsidian. */
const enterPanel = Prec.high(keymap.of([{
    key: 'ArrowUp',
    run: (view) => {
        const end = panelEnd(view.state)
        if (end === null || view.moveVertically(view.state.selection.main, false).head > end) return false
        view.dom.querySelector<HTMLElement>('.cm-properties-add')?.focus()
        return true
    },
}]))

/**
 * Obsidian's Properties view: the frontmatter shows as a panel of typed properties above the note, edited in place.
 * The YAML keeps its comments, order and formatting (see `utility/properties`).
 */
export function propertiesPanel(options: PropertiesOptions = {}): Extension {
    return [propertiesOptions.of(options), panelField, protectFrontmatter, startProperties, keepSelectionInBody, initialSelection, enterPanel]
}
