<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { EditorView } from '@codemirror/view'
import {
    ActionList, blockAt, canMoveBlock, deleteBlock, dropTarget, floatingContent, label, moveBlock, moveBlockTo, resolveActions,
    type Block, type EditorAction, type EditorContext, type Side,
} from '../../kit'

/** Pointer travel (px) before a press on the handle becomes a drag instead of a click. */
const DRAG_THRESHOLD = 4
/** Handle box width (px); its right edge touches the block's first character so hover never gaps. */
const HANDLE_WIDTH = 28

const props = defineProps<{ editor: EditorContext }>()
const { view } = props.editor

const hovered = shallowRef<Block | null>(null)
const handlePos = ref<{ top: number, left: number } | null>(null)
const indicator = ref<{ top: number, left: number, width: number } | null>(null)
const menuBlock = shallowRef<Block | null>(null)
const dragging = ref(false)
const handle = ref<HTMLElement>()
let drag: { block: Block, x: number, y: number, active: boolean, target: Block | null, side: Side } | null = null

const editable = computed(() => props.editor.state.value.facet(EditorView.editable))

const firstChar = (b: Block) => {
    const line = view.state.doc.lineAt(b.from)
    return line.from + /^\s*/.exec(line.text)![0].length
}

/** Overlay coordinates (relative to the editor root, the overlay's positioning context). */
function local(x: number, y: number) {
    const box = view.dom.getBoundingClientRect()
    return { x: x - box.left, y: y - box.top }
}

/**
 * Viewport top/bottom of the rendered line (or block widget) at `pos`. Uses CodeMirror's height map,
 * not `coordsAtPos`, which returns null for positions hidden by live-preview decorations (fences, marks).
 */
function lineSpan(pos: number) {
    const b = view.lineBlockAt(pos)
    return { top: b.top + view.documentTop, bottom: b.bottom + view.documentTop }
}

/**
 * Viewport x where `block` starts: its list mark for list items (indentation is visual), otherwise
 * the content column (rendered fences and widgets don't sit at their source position).
 */
function blockLeft(block: Block) {
    const content = view.contentDOM
    const column = content.getBoundingClientRect().left + parseFloat(getComputedStyle(content).paddingLeft)
    return block.name === 'ListItem' ? view.coordsAtPos(firstChar(block), 1)?.left ?? column : column
}

function show(block: Block | null) {
    hovered.value = block
    if (!block) {
        handlePos.value = null
        return
    }
    // Centre on the first visual line; wrapped lines and block widgets (tables) are taller, so cap it.
    const first = lineSpan(block.from)
    const lineHeight = Math.min(first.bottom - first.top, view.defaultLineHeight * 1.6)
    const p = local(blockLeft(block) - HANDLE_WIDTH, first.top + lineHeight / 2)
    handlePos.value = { top: p.y, left: p.x }
}

function onMouseMove(e: MouseEvent) {
    if (drag || menuBlock.value || handle.value?.contains(e.target as Node)) return
    if (!editable.value) return show(null)
    const block = blockAt(view.state, view.posAtCoords({ x: e.clientX, y: e.clientY }, false))
    if (block?.from !== hovered.value?.from || block?.to !== hovered.value?.to) show(block)
}

function onMouseLeave(e: MouseEvent) {
    if (!drag && !menuBlock.value && !handle.value?.contains(e.relatedTarget as Node)) show(null)
}

function onScroll() {
    if (!drag && !menuBlock.value) show(null)
}

watch(() => props.editor.update.value, (u) => {
    if (!u || drag?.active || menuBlock.value) return
    if (u.docChanged) show(null) // hide while typing; the next mousemove brings it back
    else if (u.geometryChanged && hovered.value) show(hovered.value)
})

/** The block under viewport `y` and which half of it the pointer is in. Blank lines snap to the next block. */
function targetAt(y: number): { block: Block, side: Side } | null {
    const content = view.contentDOM.getBoundingClientRect()
    const pos = view.posAtCoords({ x: content.left + content.width / 2, y }, false)
    const { doc } = view.state
    const lineBlock = (n: number) => {
        const line = doc.line(n)
        return blockAt(view.state, line.from + /^\s*/.exec(line.text)![0].length)
    }
    const block = blockAt(view.state, pos)
    if (!block) {
        const here = doc.lineAt(pos).number
        for (let n = here + 1; n <= doc.lines; n++) {
            const b = lineBlock(n)
            if (b) return { block: b, side: 'before' }
        }
        for (let n = here - 1; n >= 1; n--) {
            const b = lineBlock(n)
            if (b) return { block: b, side: 'after' }
        }
        return null
    }
    // List items split on their first line (children belong to the item); other blocks on their middle.
    const top = lineSpan(block.from).top
    const bottom = lineSpan(block.name === 'ListItem' ? block.from : block.to).bottom
    return { block, side: y < (top + bottom) / 2 ? 'before' : 'after' }
}

function indicatorFor(target: Block, side: Side) {
    const x = blockLeft(target)
    const p = local(x, side === 'before' ? lineSpan(target.from).top : lineSpan(target.to).bottom)
    return { top: p.y, left: p.x, width: view.contentDOM.getBoundingClientRect().right - x }
}

function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || !hovered.value) return
    e.preventDefault() // no text selection, no CodeMirror mousedown
    handle.value!.setPointerCapture(e.pointerId)
    drag = { block: hovered.value, x: e.clientX, y: e.clientY, active: false, target: null, side: 'before' }
}

function onPointerMove(e: PointerEvent) {
    if (!drag) return
    if (!drag.active) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_THRESHOLD) return
        drag.active = true
        dragging.value = true
        document.documentElement.style.cursor = 'grabbing'
    }
    // ponytail: no auto-scroll near the edges while dragging; the mouse wheel still scrolls.
    const hit = targetAt(e.clientY)
    const landing = hit && dropTarget(view.state, drag.block, hit.block, hit.side)
    drag.target = landing ? hit.block : null
    drag.side = hit?.side ?? 'before'
    indicator.value = landing ? indicatorFor(landing, hit.side) : null
}

function endDrag() {
    drag = null
    dragging.value = false
    indicator.value = null
    document.documentElement.style.cursor = ''
}

function onPointerUp() {
    const d = drag
    endDrag()
    if (!d) return
    if (!d.active) {
        menuBlock.value = d.block
        return
    }
    if (d.target) {
        moveBlockTo(d.block, d.target, d.side)(view)
        show(null)
    }
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && drag?.active) endDrag()
}

view.dom.addEventListener('mousemove', onMouseMove)
view.dom.addEventListener('mouseleave', onMouseLeave)
view.scrollDOM.addEventListener('scroll', onScroll)
window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => {
    endDrag()
    view.dom.removeEventListener('mousemove', onMouseMove)
    view.dom.removeEventListener('mouseleave', onMouseLeave)
    view.scrollDOM.removeEventListener('scroll', onScroll)
    window.removeEventListener('keydown', onKeydown)
})

// ponytail: fixed items; add a `blockMenuItems` facet (EditorAction factories taking the block) when hosts need more.
const menuGroups = computed<EditorAction[][]>(() => {
    const b = menuBlock.value
    if (!b) return []
    const groups: EditorAction[][] = [
        [
            { id: 'moveUp', label: 'Move up', icon: 'i-lucide-arrow-up', run: moveBlock(b, -1), isEnabled: s => canMoveBlock(s, b, -1) },
            { id: 'moveDown', label: 'Move down', icon: 'i-lucide-arrow-down', run: moveBlock(b, 1), isEnabled: s => canMoveBlock(s, b, 1) },
        ],
        [{ id: 'delete', label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', run: deleteBlock(b) }],
    ]
    return groups.map(g => resolveActions(g, props.editor.state.value))
})

function closeMenu() {
    menuBlock.value = null
    show(null)
}

function runMenu(action: EditorAction) {
    action.run?.(view)
    closeMenu()
}

const contentProps = floatingContent('bottom', 'start')
</script>

<template>
    <div
        v-show="editable && handlePos"
        ref="handle"
        class="cm-block-handle"
        role="button"
        :aria-label="label(editor.state.value, 'ui.blockHandle', 'Drag to move block, click for options')"
        :data-dragging="dragging || undefined"
        :style="{ top: `${handlePos?.top ?? 0}px`, left: `${handlePos?.left ?? 0}px` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="endDrag"
    >
        <UIcon name="i-lucide-grip-vertical" class="cm-block-handle-icon" />
    </div>
    <div
        v-if="indicator"
        class="cm-block-drop"
        :style="{ top: `${indicator.top}px`, left: `${indicator.left}px`, width: `${indicator.width}px` }"
    />
    <UPopover
        :open="!!menuBlock"
        :reference="handle"
        :content="contentProps"
        @update:open="(o: boolean) => !o && closeMenu()"
    >
        <template #content>
            <ActionList :groups="menuGroups" :state="editor.state.value" @run="runMenu" />
        </template>
    </UPopover>
</template>
