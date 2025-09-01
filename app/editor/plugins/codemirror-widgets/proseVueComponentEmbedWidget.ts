import { WidgetType, EditorView } from '@codemirror/view'
import { createApp, type App, type Component } from 'vue'

export class ProseVueComponentEmbedWidget extends WidgetType {
    private app: App | null = null

    constructor(readonly component: Component, readonly props: Record<string, any>, readonly pos: number) {
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

    override ignoreEvent(event: Event): boolean {
        // Ignore mouse events to prevent the editor from re-focusing,
        // but allow the Vue component to handle its own interactions.
        return event instanceof MouseEvent
    }
}
