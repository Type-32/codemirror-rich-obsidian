<script setup lang="ts">
import { computed, nextTick, onMounted, ref, type Directive, type ShallowRef } from 'vue'
import type { ContextMenuItem } from '@nuxt/ui'
import { Compartment, EditorState, Prec, Transaction, type TransactionSpec } from '@codemirror/state'
import { EditorView, drawSelection, keymap, type ViewUpdate } from '@codemirror/view'
import { redo, undo } from '@codemirror/commands'
import { nestedEditor, readOnly } from '../../editor/utility/nestedEditor'
import { sameVisualLine } from '../../editor/utility/tools'
import type { RenderedTable } from '../../editor/plugins/codemirror-widgets/proseTableWidget'
import {
    type TableAlign, type TableModel,
    cellRange, deleteCol, deleteRow, escapeCell, insertCol, insertRow, moveCol, moveRow, newRow, serializeTable, setAlign, setCell,
} from '../../utils/markdownTable'

const props = defineProps<{
    /** The editor the table is rendered in. */
    view: EditorView
    table: ShallowRef<RenderedTable>
    /** Receives the function that moves focus into the table from the document. */
    register: (enter: (fromBelow: boolean) => void) => void
}>()

const model = computed(() => props.table.value.model)
const root = ref<HTMLElement>()
const editable = () => props.view.state.facet(EditorView.editable)
const tableFrom = () => props.view.posAtDOM(root.value!.closest('.cm-table-widget')!)

/** Rewrites the whole table, for structural edits (rows, columns, alignment). */
function commit(next: TableModel) {
    if (!editable()) return
    const from = tableFrom()
    props.view.dispatch({ changes: { from, to: from + props.table.value.source.length, insert: serializeTable(next) } })
}

// ── Cells: one nested editor each, editable only while it's the one being edited ──

const mode = new Compartment()
const cells = new Map<string, EditorView>()
const position = new WeakMap<EditorView, [row: number, col: number]>()
const key = (r: number, c: number) => `${r}:${c}`
const textOf = (r: number, c: number) => (r < 0 ? model.value.header[c] : model.value.rows[r]?.[c]) ?? ''
const rows = () => model.value.rows.length
const cols = () => model.value.header.length
let active: EditorView | null = null

function activate(cell: EditorView, anchor: number, head = anchor) {
    if (active !== cell) {
        deactivate()
        active = cell
        cell.dispatch({ effects: mode.reconfigure([]) })
    }
    cell.focus()
    cell.dispatch({ selection: { anchor, head }, scrollIntoView: true })
}

function deactivate() {
    const cell = active
    active = null
    cell?.dispatch({ effects: mode.reconfigure(readOnly) })
}

/** The single change turning `a` into `b`, so a cursor outside the difference stays where it is. */
function diff(a: string, b: string) {
    let start = 0
    while (start < a.length && start < b.length && a[start] === b[start]) start++
    let end = 0
    while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++
    return { from: start, to: a.length - end, insert: b.slice(start, b.length - end) }
}

/** Mirror an edit (or cursor move) in the cell being edited onto its text in the source, and the cursor with it. */
function writeThrough(u: ViewUpdate) {
    const [r, c] = position.get(u.view)!
    const { source } = props.table.value
    const before = u.startState.doc.toString()
    const range = cellRange(source, r, c)
    // The cell's text starts where its trimmed source does, less the spaces it starts with (still being typed).
    const start = range && range.from - (before.trim() ? before.length - before.trimStart().length : 0)
    if (start === null || source.slice(start, start + before.length) !== before) {
        // A short row, or out of sync: write the cell through the model instead (rewrites the table).
        if (u.docChanged) commit(setCell(model.value, r, c, u.state.doc.toString()))
        return
    }
    const from = tableFrom() + start
    const spec: TransactionSpec = {
        selection: { anchor: from + u.state.selection.main.anchor, head: from + u.state.selection.main.head },
        userEvent: u.transactions.map(t => t.annotation(Transaction.userEvent)).find(Boolean),
    }
    if (u.docChanged) {
        const changes: { from: number, to: number, insert: string }[] = []
        u.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => changes.push({ from: from + fromA, to: from + toA, insert: inserted.toString() }))
        spec.changes = changes
    }
    props.view.dispatch(spec)
}

const cellExtensions = [
    // The note's drawSelection hides the native caret and selection in everything inside it, this cell included.
    drawSelection(),
    // One line, and pipes escaped, whatever is typed or pasted.
    EditorState.transactionFilter.of((tr) => {
        if (!tr.docChanged) return tr
        const text = tr.newDoc.toString(), safe = escapeCell(text)
        return safe === text ? tr : [tr, { changes: diff(text, safe), sequential: true }]
    }),
    EditorView.updateListener.of((u) => {
        if (u.focusChanged && !u.view.hasFocus) queueMicrotask(() => active === u.view && !u.view.hasFocus && deactivate())
        if (active === u.view && (u.docChanged || u.selectionSet) && !u.transactions.some(t => t.annotation(Transaction.remote))) writeThrough(u)
    }),
    Prec.highest(keymap.of([
        { key: 'Tab', run: v => step(v, 1) },
        { key: 'Shift-Tab', run: v => step(v, -1) },
        { key: 'Enter', run: (v) => { const [r, c] = position.get(v)!; void goto(r + 1, c, 'all'); return true } },
        { key: 'ArrowUp', run: v => vertical(v, -1) },
        { key: 'ArrowDown', run: v => vertical(v, 1) },
        { key: 'ArrowLeft', run: v => horizontal(v, -1) },
        { key: 'ArrowRight', run: v => horizontal(v, 1) },
        { key: 'Escape', run: () => exit(true) },
        // The cells have no history of their own: undo is the document's.
        { key: 'Mod-z', run: () => undo(props.view) },
        { key: 'Mod-y', mac: 'Mod-Shift-z', run: () => redo(props.view) },
    ])),
]

/** Edit cell (r, c), selecting its text (`all`) or with the cursor at its start or end; `r` past the last row adds one. */
async function goto(r: number, c: number, at: 'all' | 'start' | 'end') {
    if (r >= rows()) {
        if (!editable()) return
        const end = tableFrom() + props.table.value.source.length
        props.view.dispatch({ changes: { from: end, insert: newRow(props.table.value.source, cols()) } })
        await nextTick()
    }
    const cell = cells.get(key(r, c))
    if (!cell) return
    const length = cell.state.doc.length
    if (at === 'all') activate(cell, 0, length)
    else activate(cell, at === 'start' ? 0 : length)
}

/** Tab / Shift-Tab: the next or previous cell, row by row, text selected. Tab past the last cell adds a row. */
function step(v: EditorView, dir: 1 | -1) {
    const [r, c] = position.get(v)!
    if (dir > 0) void goto(c + 1 < cols() ? r : r + 1, c + 1 < cols() ? c + 1 : 0, 'all')
    else if (c > 0 || r > -1) void goto(c > 0 ? r : r - 1, c > 0 ? c - 1 : cols() - 1, 'all')
    return true
}

/** ↑/↓ on a cell's first/last visual line: the cell above/below at the same x, or out of the table. A selection collapses first. */
function vertical(v: EditorView, dir: 1 | -1) {
    const sel = v.state.selection.main
    if (!sel.empty) {
        v.dispatch({ selection: { anchor: dir > 0 ? sel.to : sel.from } })
        return true
    }
    if (!sameVisualLine(v, sel.head, dir > 0 ? v.state.doc.length : 0)) return false
    const [r, c] = position.get(v)!
    const cell = cells.get(key(r + dir, c))
    if (!cell) return exit(dir > 0)
    const x = v.coordsAtPos(sel.head)?.left ?? 0
    const box = cell.contentDOM.getBoundingClientRect()
    activate(cell, cell.posAtCoords({ x, y: dir > 0 ? box.top + 1 : box.bottom - 1 }, false))
    return true
}

/** ←/→ at a cell's start/end: the previous cell's end or the next cell's start, or out of the table. */
function horizontal(v: EditorView, dir: 1 | -1) {
    const sel = v.state.selection.main
    if (!sel.empty || sel.head !== (dir > 0 ? v.state.doc.length : 0)) return false
    const [r, c] = position.get(v)!
    const [tr, tc] = c + dir < 0 ? [r - 1, cols() - 1] : c + dir >= cols() ? [r + 1, 0] : [r, c + dir]
    if (tr < -1 || tr >= rows()) return exit(dir > 0)
    void goto(tr, tc, dir > 0 ? 'start' : 'end')
    return true
}

/** Back to the document: the end of the line above the table, or the start of the line below. */
function exit(below: boolean) {
    const from = tableFrom(), to = from + props.table.value.source.length
    deactivate()
    props.view.dispatch({ selection: { anchor: below ? Math.min(to + 1, props.view.state.doc.length) : Math.max(from - 1, 0) }, scrollIntoView: true })
    props.view.focus()
    return true
}

onMounted(() => props.register(fromBelow => void goto(fromBelow ? rows() - 1 : -1, 0, 'start')))

/**
 * Mounts cell [row, col]'s editor in the element and keeps it in sync with the source. Cells are keyed by position.
 * ponytail: one nested editor per cell, ~1ms each (a 40×6 table renders in ~280ms); render idle cells as static
 * HTML and mount an editor only on focus if big tables jank.
 */
const vCell: Directive<HTMLElement, [number, number]> = {
    mounted(el, { value: [r, c] }) {
        const cell = nestedEditor(props.view, textOf(r, c), el, [mode.of(readOnly), cellExtensions])
        cells.set(key(r, c), cell)
        position.set(cell, [r, c])
    },
    updated(_el, { value: [r, c] }) {
        const cell = cells.get(key(r, c))!
        const current = cell.state.doc.toString(), next = textOf(r, c)
        // The source holds the cell trimmed, so a space just typed at its end isn't a difference.
        if (current.trim() !== next) cell.dispatch({ changes: diff(current, next), annotations: Transaction.remote.of(true) })
    },
    beforeUnmount(_el, { value: [r, c] }) {
        const cell = cells.get(key(r, c))
        if (cell === active) active = null
        cell?.destroy()
        cells.delete(key(r, c))
    },
}

function onCellMousedown(e: MouseEvent, r: number, c: number) {
    const cell = cells.get(key(r, c))
    if (!cell || cell === active || e.button !== 0 || !editable()) return
    if ((e.target as Element).closest('a, .cm-link, .cm-clickable-link, .cm-table-handle')) return // links behave as links; handles drag
    e.preventDefault()
    e.stopPropagation()
    activate(cell, cell.posAtCoords({ x: e.clientX, y: e.clientY }, false))
}

/** The cell under the pointer: its column's and row's drag handles show (Obsidian). */
const hover = ref<{ row: number, col: number } | null>(null)

// ── Context menu ──

/** Cell under the last right-click; row -1 = header. */
const target = ref<{ row: number, col: number } | null>(null)
const dragging = ref<{ kind: 'row' | 'col', index: number } | null>(null)
const dropHint = ref<{ kind: 'row' | 'col', index: number } | null>(null)

function onContextMenu(row: number, col: number) {
    target.value = { row, col }
}

/** A read-only editor's tables get the browser's menu, not the editing one. */
function guardContextMenu(e: MouseEvent) {
    if (!editable()) e.stopPropagation()
}

const items = computed<ContextMenuItem[][]>(() => {
    const t = target.value
    if (!t) return []
    const m = model.value
    const alignItem = (label: string, icon: string, a: TableAlign): ContextMenuItem => ({
        label, icon, type: 'checkbox', checked: (m.align[t.col] ?? null) === a,
        onSelect: () => commit(setAlign(m, t.col, a)),
    })
    const rowOps: ContextMenuItem[] = [
        { label: 'Insert row above', icon: 'i-lucide-arrow-up-to-line', disabled: t.row < 0, onSelect: () => commit(insertRow(m, t.row)) },
        { label: 'Insert row below', icon: 'i-lucide-arrow-down-to-line', onSelect: () => commit(insertRow(m, t.row + 1)) },
        { label: 'Delete row', icon: 'i-lucide-trash-2', color: 'error', disabled: t.row < 0, onSelect: () => commit(deleteRow(m, t.row)) },
    ]
    const colOps: ContextMenuItem[] = [
        { label: 'Insert column left', icon: 'i-lucide-arrow-left-to-line', onSelect: () => commit(insertCol(m, t.col)) },
        { label: 'Insert column right', icon: 'i-lucide-arrow-right-to-line', onSelect: () => commit(insertCol(m, t.col + 1)) },
        { label: 'Delete column', icon: 'i-lucide-trash-2', color: 'error', disabled: m.header.length <= 1, onSelect: () => { const n = deleteCol(m, t.col); if (n) commit(n) } },
    ]
    const align: ContextMenuItem[] = [
        alignItem('Align left', 'i-lucide-align-left', 'left'),
        alignItem('Align center', 'i-lucide-align-center', 'center'),
        alignItem('Align right', 'i-lucide-align-right', 'right'),
        alignItem('Default alignment', 'i-lucide-align-justify', null),
    ]
    const cell: ContextMenuItem[] = [
        { label: 'Clear cell', icon: 'i-lucide-eraser', disabled: !(t.row < 0 ? m.header[t.col] : m.rows[t.row]?.[t.col]), onSelect: () => commit(setCell(m, t.row, t.col, '')) },
    ]
    return [rowOps, colOps, align, cell]
})

// ── Drag reorder (handles on row left / column top) ──
function dragStart(kind: 'row' | 'col', index: number, e: DragEvent) {
    if (!editable()) return e.preventDefault()
    dragging.value = { kind, index }
    e.dataTransfer?.setData('text/plain', `${kind}:${index}`)
    e.dataTransfer!.effectAllowed = 'move'
}
function dragOver(kind: 'row' | 'col', index: number, e: DragEvent) {
    if (dragging.value?.kind !== kind) return
    e.preventDefault()
    dropHint.value = { kind, index }
}
function drop(kind: 'row' | 'col', index: number) {
    const d = dragging.value
    dragging.value = null
    dropHint.value = null
    if (!d || d.kind !== kind || d.index === index) return
    commit(kind === 'row' ? moveRow(model.value, d.index, index) : moveCol(model.value, d.index, index))
}
function dragEnd() {
    dragging.value = null
    dropHint.value = null
}
</script>

<template>
    <UContextMenu :items="items" :size="table.value.menuSize" :ui="{ content: 'w-56' }">
        <div ref="root" class="cm-table-editor" @mousedown.stop>
            <table @contextmenu.capture="guardContextMenu" @mouseleave="hover = null">
                <thead>
                    <tr>
                        <th
                            v-for="(_h, c) in model.header" :key="`h-${c}`"
                            class="cm-table-cell"
                            :class="{ 'cm-table-drop': dropHint?.kind === 'col' && dropHint.index === c }"
                            :style="{ textAlign: model.align[c] ?? undefined }"
                            @contextmenu="onContextMenu(-1, c)"
                            @mousedown.capture="onCellMousedown($event, -1, c)"
                            @mouseenter="hover = { row: -1, col: c }"
                            @dragover="dragOver('col', c, $event)"
                            @drop="drop('col', c)"
                        >
                            <div v-cell="[-1, c]" class="cm-table-cell-content" />
                            <div
                                class="cm-table-handle cm-table-col-handle"
                                :class="{ 'is-visible': hover?.col === c }"
                                draggable="true"
                                title="Drag to reorder column"
                                @dragstart="dragStart('col', c, $event)"
                                @dragend="dragEnd"
                            >
                                <UIcon name="i-lucide-grip-horizontal" />
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(row, r) in model.rows" :key="`r-${r}`"
                        :class="{ 'cm-table-drop': dropHint?.kind === 'row' && dropHint.index === r }"
                        @dragover="dragOver('row', r, $event)"
                        @drop="drop('row', r)"
                    >
                        <td
                            v-for="(_cell, c) in row" :key="`c-${r}-${c}`"
                            class="cm-table-cell"
                            :style="{ textAlign: model.align[c] ?? undefined }"
                            @contextmenu="onContextMenu(r, c)"
                            @mousedown.capture="onCellMousedown($event, r, c)"
                            @mouseenter="hover = { row: r, col: c }"
                        >
                            <div v-cell="[r, c]" class="cm-table-cell-content" />
                            <div
                                v-if="c === 0"
                                class="cm-table-handle cm-table-row-handle"
                                :class="{ 'is-visible': hover?.row === r }"
                                draggable="true"
                                title="Drag to reorder row"
                                @dragstart="dragStart('row', r, $event)"
                                @dragend="dragEnd"
                            >
                                <UIcon name="i-lucide-grip-vertical" />
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
            <!-- Hidden in read-only editors by CSS: the template doesn't re-render when the editor's editable state changes. -->
            <UButton
                icon="i-lucide-plus" size="xs" color="neutral" variant="ghost" class="cm-table-add-row" tabindex="-1"
                aria-label="Add row below" @click="goto(rows(), 0, 'start')"
            />
            <UButton
                icon="i-lucide-plus" size="xs" color="neutral" variant="ghost" class="cm-table-add-col" tabindex="-1"
                aria-label="Add column to the right" @click="commit(insertCol(model, cols()))"
            />
        </div>
    </UContextMenu>
</template>
