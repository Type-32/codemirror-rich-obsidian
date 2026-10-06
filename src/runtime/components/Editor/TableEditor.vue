<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ContextMenuItem } from '@nuxt/ui'
import MarkdownIt from 'markdown-it'
import {
    type TableAlign, type TableModel,
    deleteCol, deleteRow, insertCol, insertRow, moveCol, moveRow, setAlign, setCell,
} from '../../utils/markdownTable'

const props = defineProps<{
    model: TableModel
    /** Receives the new model; the caller serializes and writes it to the document. */
    commit: (next: TableModel) => void
}>()

const md = new MarkdownIt({ html: false }) // cell text is untrusted
const render = (s: string) => md.renderInline(s)

/** Cell under the last right-click; row -1 = header. */
const target = ref<{ row: number, col: number } | null>(null)
const dragging = ref<{ kind: 'row' | 'col', index: number } | null>(null)
const dropHint = ref<{ kind: 'row' | 'col', index: number } | null>(null)

function onContextMenu(row: number, col: number) {
    target.value = { row, col }
}

const items = computed<ContextMenuItem[][]>(() => {
    const t = target.value
    if (!t) return []
    const m = props.model
    const alignItem = (label: string, icon: string, a: TableAlign): ContextMenuItem => ({
        label, icon, type: 'checkbox', checked: (m.align[t.col] ?? null) === a,
        onSelect: () => props.commit(setAlign(m, t.col, a)),
    })
    const rowOps: ContextMenuItem[] = [
        { label: 'Insert row above', icon: 'i-lucide-arrow-up-to-line', disabled: t.row < 0, onSelect: () => props.commit(insertRow(m, t.row)) },
        { label: 'Insert row below', icon: 'i-lucide-arrow-down-to-line', onSelect: () => props.commit(insertRow(m, t.row + 1)) },
        { label: 'Delete row', icon: 'i-lucide-trash-2', color: 'error', disabled: t.row < 0, onSelect: () => props.commit(deleteRow(m, t.row)) },
    ]
    const colOps: ContextMenuItem[] = [
        { label: 'Insert column left', icon: 'i-lucide-arrow-left-to-line', onSelect: () => props.commit(insertCol(m, t.col)) },
        { label: 'Insert column right', icon: 'i-lucide-arrow-right-to-line', onSelect: () => props.commit(insertCol(m, t.col + 1)) },
        { label: 'Delete column', icon: 'i-lucide-trash-2', color: 'error', disabled: m.header.length <= 1, onSelect: () => { const n = deleteCol(m, t.col); if (n) props.commit(n) } },
    ]
    const align: ContextMenuItem[] = [
        alignItem('Align left', 'i-lucide-align-left', 'left'),
        alignItem('Align center', 'i-lucide-align-center', 'center'),
        alignItem('Align right', 'i-lucide-align-right', 'right'),
        alignItem('Default alignment', 'i-lucide-align-justify', null),
    ]
    const cell: ContextMenuItem[] = [
        { label: 'Clear cell', icon: 'i-lucide-eraser', disabled: !(t.row < 0 ? m.header[t.col] : m.rows[t.row]?.[t.col]), onSelect: () => props.commit(setCell(m, t.row, t.col, '')) },
    ]
    return [rowOps, colOps, align, cell]
})

// ── Cell editing ──
function onFocus(e: FocusEvent, text: string) {
    (e.target as HTMLElement).textContent = text
}
function onBlur(e: FocusEvent, row: number, col: number, prev: string) {
    const el = e.target as HTMLElement
    const next = el.textContent ?? ''
    if (next !== prev) props.commit(setCell(props.model, row, col, next))
    else el.innerHTML = render(prev)
}
function onKeydown(e: KeyboardEvent, prev: string) {
    const el = e.target as HTMLElement
    if (e.key === 'Enter') { e.preventDefault(); el.blur() }
    else if (e.key === 'Escape') { el.textContent = prev; el.blur() }
    e.stopPropagation()
}

// ── Drag reorder (handles on row left / column top) ──
function dragStart(kind: 'row' | 'col', index: number, e: DragEvent) {
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
    props.commit(kind === 'row' ? moveRow(props.model, d.index, index) : moveCol(props.model, d.index, index))
}
function dragEnd() {
    dragging.value = null
    dropHint.value = null
}
</script>

<template>
    <UContextMenu :items="items" :ui="{ content: 'w-56' }">
        <div class="cm-table-editor" @mousedown.stop>
            <table>
                <thead>
                    <tr>
                        <th class="cm-table-corner" />
                        <th
                            v-for="(h, c) in model.header" :key="`hh-${c}`"
                            class="cm-table-col-handle"
                            :class="{ 'cm-table-drop': dropHint?.kind === 'col' && dropHint.index === c }"
                            draggable="true"
                            title="Drag to reorder column"
                            @dragstart="dragStart('col', c, $event)"
                            @dragover="dragOver('col', c, $event)"
                            @drop="drop('col', c)"
                            @dragend="dragEnd"
                        >⋮⋮</th>
                    </tr>
                    <tr>
                        <th class="cm-table-corner" />
                        <th
                            v-for="(h, c) in model.header" :key="`h-${c}`"
                            class="cm-table-cell"
                            :style="{ textAlign: model.align[c] ?? undefined }"
                            contenteditable="true" spellcheck="false"
                            @contextmenu="onContextMenu(-1, c)"
                            @focus="onFocus($event, h)"
                            @blur="onBlur($event, -1, c, h)"
                            @keydown="onKeydown($event, h)"
                            v-html="render(h)"
                        />
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
                            class="cm-table-row-handle"
                            draggable="true"
                            title="Drag to reorder row"
                            @dragstart="dragStart('row', r, $event)"
                            @dragend="dragEnd"
                            @contextmenu="onContextMenu(r, 0)"
                        >⋮⋮</td>
                        <td
                            v-for="(cell, c) in row" :key="`c-${r}-${c}`"
                            class="cm-table-cell"
                            :style="{ textAlign: model.align[c] ?? undefined }"
                            contenteditable="true" spellcheck="false"
                            @contextmenu="onContextMenu(r, c)"
                            @focus="onFocus($event, cell)"
                            @blur="onBlur($event, r, c, cell)"
                            @keydown="onKeydown($event, cell)"
                            v-html="render(cell)"
                        />
                    </tr>
                </tbody>
            </table>
        </div>
    </UContextMenu>
</template>
