import { WidgetType, type EditorView } from '@codemirror/view'
import { markRaw, shallowRef, type ShallowRef } from 'vue'
import PropertiesPanel from '../../../components/Editor/PropertiesPanel.vue'
import { mountVueComponent } from '../../../kit/vue'

/** The mounted panel of each widget DOM: its YAML ref (updated in place) and unmount. */
const panels = new WeakMap<HTMLElement, { yaml: ShallowRef<string>, unmount: () => void }>()

/**
 * Replaces the frontmatter with the properties panel. Any widget of this type updates the mounted panel in place
 * (`updateDOM`), so the Vue component, and with it focus and in-progress input, survives every edit.
 */
export class PropertiesWidget extends WidgetType {
    constructor(readonly yaml: string) {
        super()
    }

    override eq(other: PropertiesWidget) {
        return other.yaml === this.yaml
    }

    toDOM(view: EditorView) {
        const el = document.createElement('div')
        el.className = 'cm-properties-widget'
        el.contentEditable = 'false'
        const yaml = shallowRef(this.yaml)
        panels.set(el, { yaml, unmount: mountVueComponent(view, el, PropertiesPanel, { view: markRaw(view), yaml }) })
        return el
    }

    override updateDOM(dom: HTMLElement) {
        const panel = panels.get(dom)
        if (!panel) return false
        panel.yaml.value = this.yaml
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
