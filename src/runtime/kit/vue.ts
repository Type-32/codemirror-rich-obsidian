import { createVNode, render, type Component } from 'vue'
import type { EditorView } from '@codemirror/view'
import { vueContextFacet } from '../editor/plugins/hostAppConfig'

/**
 * Render `component` into `el` as if it were a child of the Editor component: app config,
 * auto-imported components, icons and ancestor provides (`<UApp>`'s tooltip/toast/portal context)
 * all resolve (`createApp` per mount would isolate all of that). The single mount path for every
 * Vue component CodeMirror renders. Returns the unmount function.
 */
export function mountVueComponent(view: EditorView, el: HTMLElement, component: Component, props?: Record<string, unknown>): () => void {
    const vnode = createVNode(component, props)
    const context = view.state.facet(vueContextFacet)
    if (context) vnode.appContext = context
    render(vnode, el)
    return () => render(null, el)
}
