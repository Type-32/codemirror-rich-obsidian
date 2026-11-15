import { WidgetType, type EditorView } from '@codemirror/view'
import type { EditorState } from '@codemirror/state'
import { componentMounter } from '../renderers'
import type { EmbedMount } from '../../types/editor-types'

/** What draws an embed: the host's `mount` function, or a component for the `componentMounter`. */
export interface EmbedTarget {
    mount?: EmbedMount
    component?: unknown
}

/** Whether `target` can render in `state`: it has a `mount`, or a component and a mounter for it. */
export function canEmbed(state: EditorState, target: EmbedTarget): boolean {
    return !!(target.mount || (target.component && state.facet(componentMounter)))
}

/**
 * Teardown of each widget DOM. Keyed by element, not kept on the widget: when an equal widget replaces this one,
 * CodeMirror keeps the DOM and later calls `destroy` on the *new* widget.
 */
const teardowns = new WeakMap<HTMLElement, () => void>()

const isComponent = (v: unknown) => typeof v === 'function' || (!!v && typeof v === 'object' && ('setup' in v || 'render' in v))

/**
 * A host-rendered block (custom code blocks, note embeds) drawn by its `mount` function or mounted component. An
 * equal widget (same target, equal props) keeps the rendered DOM.
 */
export class EmbedWidget extends WidgetType {
    constructor(
        readonly target: EmbedTarget,
        readonly props: Record<string, unknown>,
        readonly nodeFrom: number,
        readonly nodeTo: number,
    ) {
        super()
    }

    toDOM(view: EditorView) {
        const container = document.createElement('div')
        container.className = 'cm-embed-widget'
        container.dataset.embedPos = String(this.nodeFrom)
        container.addEventListener('mousedown', () => { if (view.hasFocus) view.dom.blur() })
        const { mount, component } = this.target
        const teardown = mount ? mount(container, this.props) : view.state.facet(componentMounter)!(view, container, component, this.props)
        if (teardown) teardowns.set(container, teardown)
        return container
    }

    override destroy(dom: HTMLElement) {
        teardowns.get(dom)?.()
        teardowns.delete(dom)
    }

    override eq(other: EmbedWidget) {
        if (this.target.mount !== other.target.mount || this.target.component !== other.target.component) return false
        const a = this.props, b = other.props
        const keys = Object.keys(a)
        if (keys.length !== Object.keys(b).length) return false
        // Props are strings or the host's link/mapping records, which may hold functions and components: those are
        // compared by the target above, not serialized.
        const replacer = (_k: string, v: unknown) => (isComponent(v) ? undefined : v)
        return keys.every(k => a[k] === b[k] || JSON.stringify(a[k], replacer) === JSON.stringify(b[k], replacer))
    }

    override ignoreEvent(event: Event) {
        return event instanceof MouseEvent
    }
}
