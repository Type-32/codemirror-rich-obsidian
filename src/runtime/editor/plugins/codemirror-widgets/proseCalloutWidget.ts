import { WidgetType, EditorView } from '@codemirror/view'
import { calloutRegex } from '../../lezer-parsers/lezerCalloutParser'
import { nestedEditor } from '../../utility/nestedEditor'

/** One quote level (with any indentation before it, for callouts inside list items). */
const QUOTE_LEVEL = /^[ \t]*> ?/

export interface Callout {
    /** Lower-cased, as in `data-callout`. */
    type: string
    /** After `|` in `[!type|metadata]`. */
    metadata: string
    fold: '' | '+' | '-'
    /** Raw title markdown; empty when the callout has none (the type is shown instead). */
    title: string
    /** Body markdown with one quote level removed, so nested quotes and callouts stay nested. */
    body: string
}

/** Split callout source (`> [!type|meta]± title` + body lines) into its parts. Null if it isn't a callout. */
export function parseCallout(source: string): Callout | null {
    const [head = '', ...rest] = source.split('\n')
    const m = calloutRegex.exec(head.replace(QUOTE_LEVEL, ''))
    if (!m) return null
    return {
        type: m[1]!.trim().toLowerCase(),
        metadata: (m[2] ?? '').slice(1),
        fold: (m[3] ?? '') as Callout['fold'],
        title: m[4]!.trim(),
        body: rest.map(line => line.replace(QUOTE_LEVEL, '')).join('\n'),
    }
}

const svg = (body: string, size = 16) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

// Obsidian's default callout icons (Lucide), by type; aliases below.
const ICONS: Record<string, string> = {
    note: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    abstract: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    todo: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    tip: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    success: '<path d="M20 6 9 17l-5-5"/>',
    question: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    failure: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    danger: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    example: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
    quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
}
const ALIASES: Record<string, string> = {
    summary: 'abstract', tldr: 'abstract', hint: 'tip', important: 'tip', check: 'success', done: 'success',
    help: 'question', faq: 'question', caution: 'warning', attention: 'warning', fail: 'failure', missing: 'failure',
    error: 'danger', cite: 'quote',
}
const EDIT_ICON = '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>'
const FOLD_ICON = '<path d="m9 18 6-6-6-6"/>'

function div(className: string, html = '') {
    const el = document.createElement('div')
    el.className = className
    el.innerHTML = html
    return el
}

/** The nested editors of each rendered callout, destroyed with its DOM. */
const nested = new WeakMap<HTMLElement, EditorView[]>()

/**
 * A rendered callout, Obsidian's way: a header (icon, title, fold chevron) and the body, both rendered by nested
 * read-only editors with the parent's own markdown rendering, so everything a note can contain works inside,
 * nested callouts included. Clicking it selects the whole callout source (revealing it); links inside work as
 * links; the chevron folds it (view state only, like Obsidian); the edit button puts the cursor at its start.
 * Keyed on its source text, so edits and undo re-render while moves don't.
 */
export class CalloutWidget extends WidgetType {
    constructor(readonly source: string, readonly callout: Callout) {
        super()
    }

    override eq(other: CalloutWidget) {
        return other.source === this.source
    }

    toDOM(view: EditorView): HTMLElement {
        const { type, metadata, fold, title, body } = this.callout
        const root = div('cm-callout-widget callout')
        root.contentEditable = 'false'
        Object.assign(root.dataset, { callout: type, calloutMetadata: metadata, calloutFold: fold })
        if (fold) root.classList.add('is-collapsible')
        if (fold === '-') root.classList.add('is-collapsed')

        const header = div('callout-title')
        header.append(div('callout-title-icon', svg(ICONS[ALIASES[type] ?? type] ?? ICONS.note!)))
        const titleEl = div('callout-title-inner')
        header.append(titleEl)
        if (fold) header.append(div('callout-fold', svg(FOLD_ICON)))
        const edit = div('edit-block-button', svg(EDIT_ICON))
        edit.setAttribute('aria-label', 'Edit this block')
        header.append(edit)
        root.append(header)
        const views = [nestedEditor(view, title || type.charAt(0).toUpperCase() + type.slice(1), titleEl)]
        nested.set(root, views)

        if (body.trim()) {
            const content = div('callout-content')
            root.append(content)
            views.push(nestedEditor(view, body, content))
        }

        // Capture phase, so the outermost editable callout handles clicks before the nested editors see them.
        root.addEventListener('mousedown', (e) => {
            const target = e.target as Element
            const chevron = target.closest('.callout-fold')
            if (chevron) {
                e.preventDefault()
                e.stopPropagation()
                chevron.closest('.callout')!.classList.toggle('is-collapsed')
                view.requestMeasure()
                return
            }
            if (target.closest('a, .cm-link, .cm-clickable-link')) return // links behave as links
            if (!view.state.facet(EditorView.editable)) return // inside a nested editor: the enclosing callout decides
            e.preventDefault()
            e.stopPropagation()
            const from = view.posAtDOM(root)
            view.dispatch({ selection: target.closest('.edit-block-button') ? { anchor: from } : { anchor: from, head: from + this.source.length } })
            view.focus()
        }, true)
        return root
    }

    override destroy(dom: HTMLElement) {
        for (const v of nested.get(dom) ?? []) v.destroy()
        nested.delete(dom)
    }

    override ignoreEvent() {
        return true
    }
}
