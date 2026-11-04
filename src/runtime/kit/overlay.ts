import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view'
import type { EditorState } from '@codemirror/state'
import { markRaw, ref, shallowRef, type Component, type Ref, type ShallowRef } from 'vue'
import { mountVueComponent } from './vue'

/** Reactive view of one editor, passed to every overlay component as its `editor` prop. */
export interface EditorContext {
    view: EditorView
    /** Replaced on every view update; computeds reading it re-run on each change. */
    state: Readonly<ShallowRef<EditorState>>
    /**
     * The latest update. Watch with `flush: 'sync'` when every update matters (e.g. telling a
     * mouse release from typing); the default flush only sees the last update of a tick.
     */
    update: Readonly<ShallowRef<ViewUpdate | null>>
    focused: Readonly<Ref<boolean>>
}

/**
 * Mount `component` once per editor view, with an `editor: EditorContext` prop, for as long as the
 * returned extension is configured. Call at **module level**: CodeMirror keeps a plugin alive across
 * reconfigures only while the same plugin object stays in the config, so a fresh call per render
 * would remount the component every time the host's extension list changes.
 */
export function vueOverlay(component: Component) {
    return ViewPlugin.define((view) => {
        const el = document.createElement('div')
        el.className = 'cm-vue-overlay'
        view.dom.appendChild(el)
        const state = shallowRef(view.state)
        const update = shallowRef<ViewUpdate | null>(null)
        const focused = ref(view.hasFocus)
        const editor: EditorContext = markRaw({ view: markRaw(view), state, update, focused })
        const unmount = mountVueComponent(view, el, component, { editor })
        return {
            update(u: ViewUpdate) {
                state.value = u.state
                update.value = u
                if (u.focusChanged) focused.value = u.view.hasFocus
            },
            destroy() {
                unmount()
                el.remove()
            },
        }
    })
}

/**
 * Floating-UI virtual element spanning `range()` (read lazily on every measure, so it follows edits
 * and scrolling): top of the first line to bottom of the last, horizontal union across lines.
 * Off-screen ranges collapse to a far-away point.
 */
export function virtualAnchor(view: EditorView, range: () => { from: number, to: number }) {
    return {
        contextElement: view.scrollDOM,
        getBoundingClientRect() {
            const { from, to } = range()
            const a = view.coordsAtPos(from, 1), b = view.coordsAtPos(to, -1)
            if (!a || !b) return new DOMRect(-9999, -9999, 0, 0)
            const left = Math.min(a.left, b.left), right = Math.max(a.right, b.right)
            return new DOMRect(left, a.top, right - left, b.bottom - a.top)
        },
    }
}

const preventDefault = (e: Event) => e.preventDefault()

/** `UPopover` `content` props for editor surfaces: opening or closing never moves focus out of the editor. */
export function floatingContent(side: 'top' | 'bottom' | 'left' | 'right', align: 'start' | 'center' | 'end' = 'center') {
    return { side, align, sideOffset: 8, collisionPadding: 8, onOpenAutoFocus: preventDefault, onCloseAutoFocus: preventDefault }
}

/** mousedown handler for surfaces: keeps editor focus and selection on clicks, except on form fields. */
export function keepEditorFocus(e: MouseEvent) {
    if (!(e.target as Element).closest('input, textarea, select')) e.preventDefault()
}