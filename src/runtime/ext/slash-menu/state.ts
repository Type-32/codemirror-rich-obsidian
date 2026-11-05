import { Prec, StateEffect, StateField, type EditorState, type Transaction } from '@codemirror/state'
import { keymap, type Command, type EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { defineItemsFacet, filterActions, resolveActions, type EditorAction } from '../../kit'

/**
 * Contribution point for the slash menu. Every extension may provide groups; they are shown in
 * precedence order after `slashMenu`'s own `items`. Only actions with `run` are listed.
 */
export const slashItems = defineItemsFacet()

/** An open slash menu: the `/` position, the text typed after it, and the highlighted match. */
export interface SlashState {
    from: number
    query: string
    selected: number
}

export const closeSlash = StateEffect.define<null>()
export const selectSlash = StateEffect.define<number>()

/** Where a `/` is just text, not a command trigger. */
const NO_TRIGGER: Record<string, true> = {
    FencedCode: true, CodeBlock: true, InlineCode: true, TexBlock: true, TexInline: true,
    YAMLFrontMatter: true, HTMLBlock: true, CommentBlock: true, Comment: true, URL: true, Autolink: true,
}

/** Matching runnable actions for `query`, grouped; empty groups dropped. */
export function slashMatches(state: EditorState, query: string): EditorAction[][] {
    return state.facet(slashItems)
        .map(group => filterActions(resolveActions(group, state).filter(a => a.run), query))
        .filter(group => group.length)
}

/** A `/` typed at line start or after whitespace, outside code, opens the menu. */
function opened(tr: Transaction): SlashState | null {
    const head = tr.state.selection.main
    if (!tr.isUserEvent('input.type') || !head.empty) return null
    let typed = ''
    tr.changes.iterChanges((_fromA, _toA, _fromB, toB, text) => {
        if (toB === head.head) typed = text.toString()
    })
    if (typed !== '/') return null
    const from = head.head - 1
    if (from > 0 && !/\s/.test(tr.state.sliceDoc(from - 1, from))) return null
    for (let n: SyntaxNode | null = syntaxTree(tr.state).resolveInner(from, 1); n; n = n.parent) {
        if (NO_TRIGGER[n.name]) return null
    }
    return { from, query: '', selected: 0 }
}

/**
 * Open slash-menu state. Closes when the cursor leaves the `/…` run (selection, other line, before the
 * slash), when the `/` is deleted, when nothing matches the typed query, or on `closeSlash`.
 */
export const slashField = StateField.define<SlashState | null>({
    create: () => null,
    update(value, tr) {
        if (tr.effects.some(e => e.is(closeSlash))) return null
        if (!value) return opened(tr)
        const { doc } = tr.state
        const head = tr.state.selection.main
        const from = tr.changes.mapPos(value.from, 1)
        if (!head.empty || head.head <= from || doc.sliceString(from, from + 1) !== '/'
            || doc.lineAt(head.head).number !== doc.lineAt(from).number) return null
        const query = doc.sliceString(from + 1, head.head)
        if (!slashMatches(tr.state, query).length) return null
        let selected = query === value.query ? value.selected : 0
        for (const e of tr.effects) if (e.is(selectSlash)) selected = e.value
        return { from, query, selected }
    },
})

/** Remove the `/query` text, close the menu, then run `action` where the slash was. */
export function runSlashAction(view: EditorView, action: EditorAction) {
    const s = view.state.field(slashField, false)
    if (!s) return
    view.dispatch({ changes: { from: s.from, to: view.state.selection.main.head }, effects: closeSlash.of(null) })
    action.run?.(view)
}

function selectBy(dir: -1 | 1): Command {
    return (view) => {
        const s = view.state.field(slashField, false)
        if (!s) return false
        const n = slashMatches(view.state, s.query).flat().length
        view.dispatch({ effects: selectSlash.of((s.selected + dir + n) % n) })
        return true
    }
}

const accept: Command = (view) => {
    const s = view.state.field(slashField, false)
    const action = s && slashMatches(view.state, s.query).flat()[s.selected]
    if (!action) return false
    runSlashAction(view, action)
    return true
}

const close: Command = (view) => {
    if (!view.state.field(slashField, false)) return false
    view.dispatch({ effects: closeSlash.of(null) })
    return true
}

/** Menu navigation; each binding only claims the key while the menu is open. */
export const slashKeymap = Prec.highest(keymap.of([
    { key: 'ArrowDown', run: selectBy(1) },
    { key: 'ArrowUp', run: selectBy(-1) },
    { key: 'Enter', run: accept },
    { key: 'Tab', run: accept },
    { key: 'Escape', run: close },
]))
