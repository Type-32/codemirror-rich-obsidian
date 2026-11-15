import { Prec, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import { keymap, type Command, type EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { headings } from '../../../kit/headings'
import { internalLinkMapFacet } from '../linkMappingConfig'
import { linkSuggestions, type LinkSuggestion, type NoteTargets } from '../../utility/linkSearch'

/** An open link completion: where the text after `[[` starts, that text, and the highlighted suggestion. */
export interface LinkQuery {
    from: number
    query: string
    selected: number
}

export const closeLinkSuggest = StateEffect.define<null>()
export const selectLinkSuggestion = StateEffect.define<number>()

/** The text after an unclosed `[[` (or `![[`) ending at the cursor, on its line. */
const OPEN = /!?\[\[([^[\]|\n]*)$/

/** Where `[[` is just text. */
const NO_TRIGGER: Record<string, true> = {
    FencedCode: true, CodeBlock: true, InlineCode: true, TexBlock: true, TexInline: true,
    YAMLFrontMatter: true, HTMLBlock: true, CommentBlock: true, Comment: true,
}

function queryAt(state: EditorState): { from: number, query: string } | null {
    const sel = state.selection.main
    if (!sel.empty || state.selection.ranges.length > 1) return null
    const line = state.doc.lineAt(sel.head)
    const m = OPEN.exec(line.text.slice(0, sel.head - line.from))
    if (!m) return null
    const from = sel.head - m[1]!.length
    for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(from, -1); n; n = n.parent) {
        if (NO_TRIGGER[n.name]) return null
    }
    return { from, query: m[1]! }
}

/**
 * Open link completion. Opens when typing (or deleting) leaves the cursor after an unclosed `[[`, follows the
 * typed text, and closes when the cursor leaves it, on a pick, on Escape, or when the editor loses focus.
 */
export const linkQueryField = StateField.define<LinkQuery | null>({
    create: () => null,
    update(value, tr) {
        if (tr.effects.some(e => e.is(closeLinkSuggest))) return null
        if (!value && !(tr.isUserEvent('input.type') || tr.isUserEvent('delete.backward'))) return null
        const q = queryAt(tr.state)
        if (!q) return null
        let selected = value && value.query === q.query && value.from === q.from ? value.selected : 0
        for (const e of tr.effects) if (e.is(selectLinkSuggestion)) selected = e.value
        return { ...q, selected }
    },
})

/** Headings and blocks (`^id` ending a line) of the note in `state`, for `[[#…` / `[[#^…`. */
export function noteTargets(state: EditorState): NoteTargets {
    const blocks: NoteTargets['blocks'] = []
    for (let n = 1; n <= state.doc.lines; n++) {
        const text = state.doc.line(n).text
        const m = /\s\^([\w-]+)$/.exec(text)
        if (m) blocks.push({ id: m[1]!, text: text.slice(0, m.index).replace(/^[\s>*+-]*(?:\d+[.)]\s*)?/, '') })
    }
    return { headings: headings(state).map(h => h.text), blocks }
}

/** The suggestions for the open query in `state` (empty when none is open). */
export function linkSuggestionsIn(state: EditorState): LinkSuggestion[] {
    const q = state.field(linkQueryField, false)
    return q ? linkSuggestions(q.query, state.facet(internalLinkMapFacet), () => noteTargets(state)) : []
}

/**
 * Replace the typed text (and the rest of the link's target, if the cursor was inside one) with `suggestion`, close
 * the link with `]]` unless bracket closing already did, and put the cursor after it, as Obsidian does.
 */
export function pickLinkSuggestion(view: EditorView, suggestion: LinkSuggestion) {
    const q = view.state.field(linkQueryField, false)
    if (!q) return
    const head = view.state.selection.main.head
    const line = view.state.doc.lineAt(head)
    const to = head + /^[^\]|]*/.exec(line.text.slice(head - line.from))![0].length
    const closed = view.state.sliceDoc(to, to + 2) === ']]'
    view.dispatch({
        changes: { from: q.from, to, insert: closed ? suggestion.insert : `${suggestion.insert}]]` },
        selection: { anchor: q.from + suggestion.insert.length + 2 },
        effects: closeLinkSuggest.of(null),
        userEvent: 'input.complete',
    })
}

/** Each binding claims its key only while suggestions are shown. */
function withSuggestions(run: (view: EditorView, q: LinkQuery, items: LinkSuggestion[]) => void): Command {
    return (view) => {
        const q = view.state.field(linkQueryField, false)
        const items = q ? linkSuggestionsIn(view.state) : []
        if (!q || !items.length) return false
        run(view, q, items)
        return true
    }
}

const move = (dir: 1 | -1) => withSuggestions((view, q, items) => view.dispatch({ effects: selectLinkSuggestion.of((q.selected + dir + items.length) % items.length) }))
const accept = withSuggestions((view, q, items) => pickLinkSuggestion(view, items[q.selected] ?? items[0]!))

/**
 * State and keys of Obsidian's `[[` completion: notes, aliases, headings and blocks (`linkSuggestions`) for the link
 * being typed. ↑/↓ select, Enter/Tab pick, Escape closes. `LinkSuggest.vue` renders it (mounted by `wysiwyg()`).
 */
export const linkSuggestPlugin: Extension = [
    linkQueryField,
    Prec.highest(keymap.of([
        { key: 'ArrowDown', run: move(1) },
        { key: 'ArrowUp', run: move(-1) },
        { key: 'Enter', run: accept },
        { key: 'Tab', run: accept },
        { key: 'Escape', run: withSuggestions(view => view.dispatch({ effects: closeLinkSuggest.of(null) })) },
    ])),
]
