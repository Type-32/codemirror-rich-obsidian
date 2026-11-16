import { createVNode, render, type AppContext, type Component } from 'vue'
import { Facet } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

/**
 * Vue context for components CodeMirror renders (widgets, overlays): the host app's context with
 * `provides` taken from the Editor component instance, so mounted components see app-level config
 * (Nuxt UI, icons, auto-registered components) *and* component-level provides from ancestors such
 * as `<UApp>` (TooltipProvider, toaster, portal target).
 */
export const vueContextFacet = Facet.define<AppContext | null, AppContext | null>({
    combine: values => values[0] ?? null,
})

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
