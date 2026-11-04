<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { EditorView, type ViewUpdate } from '@codemirror/view'
import type { EditorState } from '@codemirror/state'
import { formattableRange, mouseSelectingField, resolveActions, type EditorAction, type EditorContext } from '../../kit'
import { toolbarItems } from './items'

const KEYBOARD_SETTLE_MS = 150

const props = defineProps<{ editor: EditorContext }>()
const { view } = props.editor

const open = ref(false)
const panel = shallowRef<EditorAction | null>(null)
const root = ref<HTMLElement>()
const reference = shallowRef(anchor())
let timer: ReturnType<typeof setTimeout> | undefined
/** True while one of our actions runs, so its own edits reposition the bar instead of hiding it. */
let running = false

const groups = computed(() => props.editor.state.value.facet(toolbarItems).map(resolveActions).filter(g => g.length))

/** Virtual element spanning the selection: top of its first line to bottom of its last, horizontal union. */
function anchor() {
    return {
        contextElement: view.scrollDOM,
        getBoundingClientRect() {
            const { from, to } = view.state.selection.main
            const a = view.coordsAtPos(from, 1), b = view.coordsAtPos(to, -1)
            if (!a || !b) return new DOMRect(-9999, -9999, 0, 0)
            const left = Math.min(a.left, b.left), right = Math.max(a.right, b.right)
            return new DOMRect(left, a.top, right - left, b.bottom - a.top)
        },
    }
}

const focusInside = () => !!root.value?.contains(document.activeElement)

function canShow(state: EditorState) {
    return groups.value.length > 0
        && state.facet(EditorView.editable)
        && (view.hasFocus || focusInside())
        && !!formattableRange(state)
}

function show() {
    clearTimeout(timer)
    if (!canShow(view.state)) return hide()
    reference.value = anchor()
    open.value = true
}

function hide() {
    clearTimeout(timer)
    open.value = false
    panel.value = null
}

// flush: 'sync' so every update is seen; a mouse release followed by another transaction in the
// same tick would otherwise be missed.
watch(() => props.editor.update.value, (u: ViewUpdate | null) => {
    if (!u) return
    const dragging = u.state.field(mouseSelectingField, false)
    const released = u.startState.field(mouseSelectingField, false) && !dragging
    if (running || (panel.value && !u.selectionSet)) return open.value && show()
    if (dragging) return hide()
    if (released) return show()
    // Keyboard selection or edit (incl. shortcuts like Mod-b): show once it settles. Typing collapses
    // the selection, so the deferred show() finds nothing to format and stays hidden.
    if (u.docChanged || u.selectionSet) {
        hide()
        timer = setTimeout(show, KEYBOARD_SETTLE_MS)
    }
}, { flush: 'sync' })

watch(props.editor.focused, (focused) => {
    // Focus may be moving into the toolbar (link input): check once it has landed.
    if (!focused) setTimeout(() => !view.hasFocus && !focusInside() && hide())
})

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open.value) hide()
}
view.contentDOM.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => {
    clearTimeout(timer)
    view.contentDOM.removeEventListener('keydown', onKeydown)
})

function trigger(action: EditorAction) {
    if (action.panel) {
        panel.value = action
        return
    }
    running = true
    try {
        action.run?.(view)
    } finally {
        running = false
    }
}

function closePanel() {
    panel.value = null
    view.focus()
}

/** Keep editor focus and selection when clicking buttons; inputs (panels) still get focus. */
function keepFocus(e: MouseEvent) {
    if (!(e.target as Element).closest('input, textarea, select')) e.preventDefault()
}

const isActive = (a: EditorAction) => !!a.isActive?.(props.editor.state.value)
const isDisabled = (a: EditorAction) => !!a.isEnabled && !a.isEnabled(props.editor.state.value)

const contentProps = {
    side: 'top' as const,
    align: 'center' as const,
    sideOffset: 8,
    collisionPadding: 8,
    onOpenAutoFocus: (e: Event) => e.preventDefault(),
    onCloseAutoFocus: (e: Event) => e.preventDefault(),
}
</script>

<template>
    <UPopover :open="open" :reference="reference" :dismissible="false" :content="contentProps">
        <template #content>
            <div ref="root" class="cm-selection-toolbar" role="toolbar" @mousedown="keepFocus">
                <component :is="panel.panel" v-if="panel" :editor="editor" :close="closePanel" />
                <template v-else>
                    <template v-for="(group, i) in groups" :key="i">
                        <span v-if="i" class="cm-selection-toolbar-separator" />
                        <UTooltip v-for="action in group" :key="action.id" :text="action.label" :kbds="action.kbds">
                            <UButton
                                :icon="action.icon"
                                :label="action.icon ? undefined : action.label"
                                :aria-label="action.label"
                                :active="isActive(action)"
                                :disabled="isDisabled(action)"
                                color="neutral"
                                variant="ghost"
                                active-color="primary"
                                active-variant="soft"
                                size="sm"
                                @click="trigger(action)"
                            />
                        </UTooltip>
                    </template>
                </template>
            </div>
        </template>
    </UPopover>
</template>
