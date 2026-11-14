import { WidgetType, type EditorView } from '@codemirror/view'
import { markRaw, shallowRef, type ShallowRef } from 'vue'
import PropertiesPanel from '../../../components/Editor/PropertiesPanel.vue'
import { mountVueComponent } from '../../../kit/vue'
import type { MenuSize } from '../hostAppConfig'

/** The mounted panel of each widget DOM: its YAML and menu size refs (updated in place) and unmount. */
const panels = new WeakMap<HTMLElement, { yaml: ShallowRef<string>, menuSize: ShallowRef<MenuSize | undefined>, unmount: () => void }>()

/**
 * Replaces the frontmatter with the properties panel. Any widget of this type updates the mounted panel in place
 * (`updateDOM`), so the Vue component, and with it focus and in-progress input, survives every edit.
 */
export class PropertiesWidget extends WidgetType {
    constructor(readonly yaml: string, readonly menuSize: MenuSize | undefined) {
        super()
    }

    override eq(other: PropertiesWidget) {
        return other.yaml === this.yaml && other.menuSize === this.menuSize
    }

    toDOM(view: EditorView) {
        const el = document.createElement('div')
        el.className = 'cm-properties-widget'
        el.contentEditable = 'false'
        const yaml = shallowRef(this.yaml)
        const menuSize = shallowRef(this.menuSize)
        panels.set(el, { yaml, menuSize, unmount: mountVueComponent(view, el, PropertiesPanel, { view: markRaw(view), yaml, menuSize }) })
        return el
    }

    override updateDOM(dom: HTMLElement) {
        const panel = panels.get(dom)
        if (!panel) return false
        panel.yaml.value = this.yaml
        panel.menuSize.value = this.menuSize
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
