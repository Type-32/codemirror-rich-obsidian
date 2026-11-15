import { WidgetType, type EditorView } from '@codemirror/view'
import { propertiesRenderer, type Mounted, type PanelState } from '../renderers'

/** The mounted panel of each widget DOM. */
const panels = new WeakMap<HTMLElement, Mounted<PanelState>>()

/**
 * Replaces the frontmatter with the properties panel (`propertiesRenderer`). Any widget of this type updates the
 * mounted panel in place (`updateDOM`), so the panel, and with it focus and in-progress input, survives every edit.
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
        panels.set(el, view.state.facet(propertiesRenderer)!(view, el, this.panel))
        return el
    }

    override updateDOM(dom: HTMLElement) {
        const mounted = panels.get(dom)
        if (!mounted) return false
        mounted.update(this.panel)
        return true
    }

    override destroy(dom: HTMLElement) {
        panels.get(dom)?.destroy()
        panels.delete(dom)
    }

    override ignoreEvent() {
        return true
    }
}
