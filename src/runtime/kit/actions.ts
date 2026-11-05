import type { Component } from 'vue'
import { Facet, type EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { insertBlock, setLinePrefix, toggleMark, toggleWikilink } from './commands'
import { linkAt, markAt, wikilinkAt, type MarkType } from './queries'
import { label } from './labels'
import LinkPanel from './components/LinkPanel.vue'

/**
 * One user-facing editor action. Shared item model for toolbars and menus: a host surface shows
 * `label`/`icon`/`kbds`, reflects `isActive`/`isEnabled`, and on trigger calls `run` or, if the
 * action needs input, swaps its content to `panel`.
 */
export interface EditorAction {
    id: string
    label: string
    /** Iconify name, e.g. `i-lucide-bold`. Without one, surfaces show `label` as text. */
    icon?: string
    /** Shortcut hint in Nuxt UI `UKbd` values, e.g. `['meta', 'b']`. Display only; bind keys yourself. */
    kbds?: string[]
    /** Extra search terms for filterable surfaces. */
    keywords?: string[]
    /** Nuxt UI color for menu surfaces, e.g. `'error'` for destructive actions. */
    color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
    run?: (view: EditorView) => void
    /** Inline UI instead of `run`, rendered by the host surface with props `{ editor: EditorContext, close: () => void }`. */
    panel?: Component
    isActive?: (state: EditorState) => boolean
    isEnabled?: (state: EditorState) => boolean
}

/** A built-in action id (see `builtinActions`) or a custom action. */
export type ActionEntry = string | EditorAction

/** A flat list is one group; nested arrays are visually separated groups. `[]` = none. */
export type ActionItems = ActionEntry[] | ActionEntry[][]

/**
 * Contribution point for a surface's items (toolbar, menu). Every extension may provide groups; they
 * are concatenated in precedence order and empty groups dropped.
 */
export function defineItemsFacet() {
    return Facet.define<ActionItems, ActionEntry[][]>({
        combine: values => values
            .flatMap(v => (Array.isArray(v[0]) ? v as ActionEntry[][] : [v as ActionEntry[]]))
            .filter(group => group.length),
    })
}

function mark(id: MarkType, label: string, icon: string, kbds: string[]): EditorAction {
    return {
        id, label, icon, kbds,
        run: toggleMark(id),
        isActive: (s) => !!markAt(s, id, s.selection.main.from, s.selection.main.to),
    }
}

export const builtinActions: Record<string, EditorAction> = {
    bold: mark('bold', 'Bold', 'i-lucide-bold', ['meta', 'b']),
    italic: mark('italic', 'Italic', 'i-lucide-italic', ['meta', 'i']),
    strikethrough: mark('strikethrough', 'Strikethrough', 'i-lucide-strikethrough', ['meta', 'shift', 'x']),
    highlight: mark('highlight', 'Highlight', 'i-lucide-highlighter', ['meta', 'shift', 'h']),
    link: {
        id: 'link', label: 'Link', icon: 'i-lucide-link',
        panel: LinkPanel,
        isActive: (s) => !!linkAt(s, s.selection.main.from, s.selection.main.to),
    },
    wikilink: {
        id: 'wikilink', label: 'Internal link', icon: 'i-lucide-brackets',
        run: toggleWikilink,
        isActive: (s) => !!wikilinkAt(s, s.selection.main.from, s.selection.main.to),
    },

    // Block types. Line prefixes replace whatever block syntax the cursor line already has.
    paragraph: { id: 'paragraph', label: 'Text', icon: 'i-lucide-pilcrow', keywords: ['plain', 'p'], run: setLinePrefix('') },
    heading1: { id: 'heading1', label: 'Heading 1', icon: 'i-lucide-heading-1', keywords: ['h1', 'title'], run: setLinePrefix('# ') },
    heading2: { id: 'heading2', label: 'Heading 2', icon: 'i-lucide-heading-2', keywords: ['h2', 'subtitle'], run: setLinePrefix('## ') },
    heading3: { id: 'heading3', label: 'Heading 3', icon: 'i-lucide-heading-3', keywords: ['h3'], run: setLinePrefix('### ') },
    bulletList: { id: 'bulletList', label: 'Bullet list', icon: 'i-lucide-list', keywords: ['ul', 'unordered'], run: setLinePrefix('- ') },
    orderedList: { id: 'orderedList', label: 'Numbered list', icon: 'i-lucide-list-ordered', keywords: ['ol', 'ordered'], run: setLinePrefix('1. ') },
    taskList: { id: 'taskList', label: 'Task list', icon: 'i-lucide-list-checks', keywords: ['todo', 'checkbox'], run: setLinePrefix('- [ ] ') },
    quote: { id: 'quote', label: 'Quote', icon: 'i-lucide-text-quote', keywords: ['blockquote'], run: setLinePrefix('> ') },
    callout: { id: 'callout', label: 'Callout', icon: 'i-lucide-info', keywords: ['admonition', 'note'], run: setLinePrefix('> [!note] ') },
    codeBlock: { id: 'codeBlock', label: 'Code block', icon: 'i-lucide-square-code', keywords: ['pre', 'snippet', 'fence'], run: insertBlock('```\n', '\n```') },
    mathBlock: { id: 'mathBlock', label: 'Math block', icon: 'i-lucide-sigma', keywords: ['latex', 'tex', 'equation'], run: insertBlock('$$\n', '\n$$') },
    // Tables render as a widget, so the cursor goes on its own line below rather than into hidden source.
    table: { id: 'table', label: 'Table', icon: 'i-lucide-table', keywords: ['grid'], run: insertBlock('|  |  |\n| --- | --- |\n|  |  |\n\n') },
    divider: { id: 'divider', label: 'Divider', icon: 'i-lucide-minus', keywords: ['hr', 'rule', 'separator'], run: insertBlock('---\n') },
}

/**
 * Resolve ids to built-ins; unknown ids are dropped with a console warning. With `state`, labels
 * come from `editorLabels` by action id (the action's own `label` is the fallback).
 */
export function resolveActions(entries: readonly ActionEntry[], state?: EditorState): EditorAction[] {
    return entries.flatMap((e) => {
        const action = typeof e === 'string' ? builtinActions[e] : e
        if (!action) {
            console.warn(`[codemirror-rich-obsidian-editor] unknown action "${e}"`)
            return []
        }
        const text = state ? label(state, action.id, action.label) : action.label
        return [text === action.label ? action : { ...action, label: text }]
    })
}

/** Actions whose label, id or keywords contain `query` (case-insensitive); order is preserved. */
export function filterActions(actions: readonly EditorAction[], query: string): EditorAction[] {
    const q = query.trim().toLowerCase()
    if (!q) return [...actions]
    return actions.filter(a => [a.label, a.id, ...(a.keywords ?? [])].some(s => s.toLowerCase().includes(q)))
}
