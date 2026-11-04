import { WidgetType, type EditorView } from '@codemirror/view'
import type { Component } from 'vue'
import { mountVueComponent } from '../../../kit/vue'

/**
 * Mounts a host-provided Vue component as a block widget (image embeds, custom code blocks,
 * note embeds). Rendered as a vnode in the host app's context; torn down in destroy().
 */
export class ProseVueComponentEmbedWidget extends WidgetType {
    private unmount: (() => void) | null = null

    constructor(
        readonly component: Component,
        readonly props: Record<string, unknown>,
        readonly nodeFrom: number,
        readonly nodeTo: number,
    ) {
        super()
    }

    toDOM(view: EditorView) {
        const container = document.createElement('div')
        container.className = 'vue-embed-widget'
        container.dataset.embedPos = String(this.nodeFrom)
        container.addEventListener('mousedown', () => { if (view.hasFocus) view.dom.blur() })
        this.unmount = mountVueComponent(view, container, this.component, this.props)
        return container
    }

    override destroy() {
        this.unmount?.()
        this.unmount = null
    }

    override eq(other: ProseVueComponentEmbedWidget) {
        if (this.component !== other.component) return false
        const a = this.props, b = other.props
        const keys = Object.keys(a)
        if (keys.length !== Object.keys(b).length) return false
        // Props are strings or the host's link/mapping records (which may carry a Vue component —
        // not serializable, compared by reference via the replacer).
        const replacer = (_k: string, v: unknown) => (typeof v === 'function' || (v && typeof v === 'object' && ('setup' in v || 'render' in v)) ? undefined : v)
        return keys.every(k => a[k] === b[k] || JSON.stringify(a[k], replacer) === JSON.stringify(b[k], replacer))
    }

    override ignoreEvent(event: Event) {
        return event instanceof MouseEvent
    }
}
