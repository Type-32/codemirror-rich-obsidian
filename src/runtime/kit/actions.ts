import type { Component } from 'vue'
import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { toggleMark, toggleWikilink } from './commands'
import { linkAt, markAt, wikilinkAt, type MarkType } from './queries'
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
    run?: (view: EditorView) => void
    /** Inline UI instead of `run`, rendered by the host surface with props `{ editor: EditorContext, close: () => void }`. */
    panel?: Component
    isActive?: (state: EditorState) => boolean
    isEnabled?: (state: EditorState) => boolean
}

/** A built-in action id (see `builtinActions`) or a custom action. */
export type ActionEntry = string | EditorAction

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
}

/** Resolve ids to built-ins; unknown ids are dropped with a console warning. */
export function resolveActions(entries: readonly ActionEntry[]): EditorAction[] {
    return entries.flatMap((e) => {
        if (typeof e !== 'string') return [e]
        const action = builtinActions[e]
        if (!action) console.warn(`[codemirror-rich-obsidian-editor] unknown action "${e}"`)
        return action ? [action] : []
    })
}
