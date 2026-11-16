import { markRaw, shallowRef, type AppContext, type Component } from 'vue'
import type { Extension } from '@codemirror/state'
import { mountVueComponent, vueContextFacet } from '../kit/vue'
import { vueOverlay } from '../kit/overlay'
import { componentMounter, propertiesRenderer, tableRenderer, type Renderer } from '../editor/plugins/renderers'
import { nestedExtensions } from '../editor/utility/nestedEditor'
import { tableEntry } from '../editor/plugins/codemirror-widgets/proseTableWidget'
import { linkQueryField, linkSuggestPlugin } from '../editor/plugins/codemirror-editor-plugins/linkSuggestPlugin'
import TableEditor from '../components/Editor/TableEditor.vue'
import PropertiesPanel from '../components/Editor/PropertiesPanel.vue'
import LinkSuggest from '../components/Editor/LinkSuggest.vue'

/** Mounts `component` with `view` and the props as a ref named `key` (plus `extra(el)`); an update sets the ref. */
function vueRenderer<P>(component: Component, key: string, extra?: (el: HTMLElement) => Record<string, unknown>): Renderer<P> {
    return (view, el, props) => {
        const state = shallowRef(props)
        const unmount = mountVueComponent(view, el, component, { view: markRaw(view), [key]: state, ...extra?.(el) })
        return { update: (next) => { state.value = next }, destroy: unmount }
    }
}

// Module-level, so reconfiguring keeps the mounted overlay (see `vueOverlay`).
const ui: Extension = [
    tableRenderer.of(vueRenderer(TableEditor, 'table', el => ({ register: (enter: (fromBelow: boolean) => void) => tableEntry.set(el, enter) }))),
    propertiesRenderer.of(vueRenderer(PropertiesPanel, 'panel')),
    componentMounter.of((view, el, component, props) => mountVueComponent(view, el, component as Component, props)),
    // `[[` completion and its popover, mounted the first time a completion opens (most table cells never do).
    linkSuggestPlugin,
    vueOverlay(LinkSuggest, state => state.field(linkQueryField, false) !== null),
]

/**
 * The editor's Vue UI: tables, the properties panel, the `[[` completion popover, and Vue components given as embeds
 * (`embedComponent`) or code blocks (`component`), rendered with `context` (see `vueContextFacet`) in this editor and
 * its nested ones. `<Editor>` installs it; add it yourself only when building your own `EditorView`.
 */
export function vueRenderers(context: AppContext | null = null): Extension {
    const all = [vueContextFacet.of(context), ui]
    return [all, nestedExtensions.of(all)]
}
