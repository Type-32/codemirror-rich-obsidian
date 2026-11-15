import { WidgetType, type EditorView } from '@codemirror/view'
import { markRaw, shallowRef, type ShallowRef } from 'vue'
import PropertiesPanel from '../../../components/Editor/PropertiesPanel.vue'
import { mountVueComponent } from '../../../kit/vue'
import type { MenuSize } from '../hostAppConfig'
import type { PropertiesOptions } from '../../types/editor-types'

/** Everything the panel renders from; a change to any of it (the YAML, the host's options, the editor turning
 *  read-only) reaches the mounted panel. */
export interface PanelState {
    yaml: string
    options: PropertiesOptions
    menuSize: MenuSize | undefined
    editable: boolean
}

/** The mounted panel of each widget DOM: its state ref (updated in place) and unmount. */
const panels = new WeakMap<HTMLElement, { panel: ShallowRef<PanelState>, unmount: () => void }>()

/**
 * Replaces the frontmatter with the properties panel. Any widget of this type updates the mounted panel in place
 * (`updateDOM`), so the Vue component, and with it focus and in-progress input, survives every edit.
 */
export class PropertiesWidget extends WidgetType {
    constructor(readonly panel: PanelState) {
        super()
    }

    override eq(other: PropertiesWidget) {
        const a = this.panel, b = other.panel
        return a.yaml === b.yaml && a.options === b.options && a.menuSize === b.menuSize && a.editable === b.editable
    }

    toDOM(view: EditorView) {
        const el = document.createElement('div')
        el.className = 'cm-properties-widget'
        el.contentEditable = 'false'
        const panel = shallowRef(this.panel)
        panels.set(el, { panel, unmount: mountVueComponent(view, el, PropertiesPanel, { view: markRaw(view), panel }) })
        return el
    }

    override updateDOM(dom: HTMLElement) {
        const mounted = panels.get(dom)
        if (!mounted) return false
        mounted.panel.value = this.panel
        return true
    }

    override destroy(dom: HTMLElement) {
        panels.get(dom)?.unmount()
        panels.delete(dom)
    }

    override ignoreEvent() {
        return true
    }
}
