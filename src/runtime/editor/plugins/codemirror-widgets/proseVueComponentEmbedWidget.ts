import { WidgetType, EditorView } from '@codemirror/view'
import { createApp, type App, type Component } from 'vue'

export class ProseVueComponentEmbedWidget extends WidgetType {
    private app: App | null = null

    constructor(
        readonly component: Component, 
        readonly props: Record<string, any>, 
        readonly pos: number,
        readonly nodeFrom: number,
        readonly nodeTo: number
    ) {
        super()
    }

    toDOM(view: EditorView) {
        const container = document.createElement('div')
        container.className = 'vue-embed-widget'
        container.dataset.embedPos = String(this.pos)

        container.addEventListener('mousedown', () => {
            if (view.hasFocus) {
                view.dom.blur()
            }
        })

        this.app = createApp(this.component, this.props)
        this.app.mount(container)

        return container
    }

    override destroy() {
        if (this.app) {
            this.app.unmount()
        }
    }

    override eq(other: ProseVueComponentEmbedWidget): boolean {
        // Widget is considered equal if:
        // 1. Same component type
        // 2. Same position range
        // 3. Same props (deep comparison of relevant props)
        if (this.component !== other.component) return false
        if (this.nodeFrom !== other.nodeFrom || this.nodeTo !== other.nodeTo) return false
        
        // Compare props - do a shallow comparison for performance
        // Deep comparison could be expensive for large prop objects
        const thisKeys = Object.keys(this.props)
        const otherKeys = Object.keys(other.props)
        
        if (thisKeys.length !== otherKeys.length) return false
        
        for (const key of thisKeys) {
            if (this.props[key] !== other.props[key]) {
                // Special handling for objects that might be the same reference
                if (typeof this.props[key] === 'object' && typeof other.props[key] === 'object') {
                    // For linkData, filePath, and display - compare by value
                    if (key === 'linkData') {
                        const thisLink = this.props[key]
                        const otherLink = other.props[key]
                        if (thisLink?.referenceId !== otherLink?.referenceId) return false
                        if (thisLink?.name !== otherLink?.name) return false
                        if (thisLink?.filePath !== otherLink?.filePath) return false
                        continue
                    }
                    // For other objects, assume different if not same reference
                    return false
                }
                return false
            }
        }
        
        return true
    }

    override ignoreEvent(event: Event): boolean {
        // Ignore mouse events to prevent the editor from re-focusing,
        // but allow the Vue component to handle its own interactions.
        return event instanceof MouseEvent
    }
}
