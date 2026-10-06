import { WidgetType, type EditorView } from '@codemirror/view'
// @ts-ignore
import MarkdownIt from 'markdown-it'
// @ts-ignore
import markdownItObsidianCallouts from 'markdown-it-obsidian-callouts'

// html:false — note content is untrusted; raw HTML in a callout must not reach innerHTML.
const md = new MarkdownIt({ html: false }).use(markdownItObsidianCallouts)

const EDIT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 16 4-4-4-4"></path><path d="m6 8-4 4 4 4"></path><path d="m14.5 4-5 16"></path></svg>'
const FOLD_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>'

/** Renders one callout blockquote. Keyed on its source text so edits/undo re-render, moves don't. */
export class CalloutWidget extends WidgetType {
    constructor(readonly source: string) {
        super()
    }

    override eq(other: CalloutWidget) {
        return other.source === this.source
    }

    toDOM(view: EditorView): HTMLElement {
        const tmp = document.createElement('div')
        tmp.innerHTML = md.render(this.source)
        const el = tmp.querySelector<HTMLElement>('.callout')
        if (!el) {
            const fallback = document.createElement('div')
            fallback.className = 'cm-callout-widget callout callout-error'
            fallback.textContent = this.source
            return fallback
        }
        el.classList.add('cm-callout-widget')
        el.contentEditable = 'false'

        const edit = document.createElement('div')
        edit.className = 'edit-block-button'
        edit.setAttribute('aria-label', 'Edit this block')
        edit.innerHTML = EDIT_ICON
        edit.onmousedown = e => { e.preventDefault(); e.stopPropagation() }
        edit.onclick = e => {
            e.stopPropagation()
            // Widget position is the doc position where this decoration is mounted now.
            view.dispatch({ selection: { anchor: view.posAtDOM(el) } })
            view.focus()
        }

        const title = el.querySelector('.callout-title')
        if (title) {
            const fold = el.querySelector('.callout-fold')
            if (fold) fold.innerHTML = FOLD_ICON
            title.appendChild(edit)
        } else {
            el.prepend(edit)
        }
        return el
    }

    override ignoreEvent(event: Event) {
        if (event.type !== 'click' && event.type !== 'mousedown') return false
        const t = event.target as Element
        return !!(t.closest('.edit-block-button') || t.closest('.callout-fold'))
    }
}
