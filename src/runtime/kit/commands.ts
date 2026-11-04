import { EditorSelection, type SelectionRange, type TransactionSpec } from '@codemirror/state'
import type { Command, EditorView } from '@codemirror/view'
import { MARKS, linkAt, markAt, wikilinkAt, type MarkType } from './queries'

function run(view: EditorView, spec: TransactionSpec): true {
    view.dispatch(view.state.update(spec, { scrollIntoView: true }))
    return true
}

/** Insert `open`/`close` around [from, to], keeping `range`'s direction over the wrapped text. */
function wrap(range: SelectionRange, from: number, to: number, open: string, close: string) {
    const shift = open.length
    return {
        changes: [{ from, insert: open }, { from: to, insert: close }],
        range: range.empty
            ? EditorSelection.cursor(range.head + shift)
            : EditorSelection.range(range.anchor + shift, range.head + shift),
    }
}

/** An empty range acts on the word under the cursor, if any. */
function target(view: EditorView, range: SelectionRange): [number, number] | null {
    if (!range.empty) return [range.from, range.to]
    const word = view.state.wordAt(range.head)
    return word ? [word.from, word.to] : null
}

/**
 * Toggle an inline mark on every selection range. Unwraps when a mark of that type wraps the range
 * exactly (see `markAt`); otherwise wraps it. An empty range acts on the word under the cursor, or
 * inserts an empty pair with the cursor inside.
 */
export function toggleMark(type: MarkType): Command {
    const { delim } = MARKS[type]
    return (view) => {
        const { state } = view
        return run(view, state.changeByRange((range) => {
            const t = target(view, range)
            if (!t) return { changes: { from: range.head, insert: delim + delim }, range: EditorSelection.cursor(range.head + delim.length) }
            const node = markAt(state, type, t[0], t[1])
            if (!node) return wrap(range, t[0], t[1], delim, delim)
            const changes = state.changes([
                { from: node.firstChild!.from, to: node.firstChild!.to },
                { from: node.lastChild!.from, to: node.lastChild!.to },
            ])
            return { changes, range: range.map(changes) }
        }))
    }
}

/** Toggle `[[…]]` on every selection range. Unwrapping keeps the alias if there is one, else the target. */
export const toggleWikilink: Command = (view) => {
    const { state } = view
    return run(view, state.changeByRange((range) => {
        const t = target(view, range)
        if (!t) return { changes: { from: range.head, insert: '[[]]' }, range: EditorSelection.cursor(range.head + 2) }
        const node = wikilinkAt(state, t[0], t[1])
        if (!node) return wrap(range, t[0], t[1], '[[', ']]')
        const display = node.getChild('InternalDisplay')
        const text = display
            ? state.sliceDoc(display.from, display.to)
            : state.sliceDoc(node.firstChild!.to, node.lastChild!.from)
        return {
            changes: { from: node.from, to: node.to, insert: text },
            range: EditorSelection.range(node.from, node.from + text.length),
        }
    }))
}

/** `<…>` when the URL would otherwise break the `(url)` syntax. */
const formatUrl = (url: string) => (/[\s()<>]/.test(url) ? `<${url}>` : url)

/**
 * Set the main selection's `[text](url)`. On an existing link: replace its URL, or unwrap it to plain
 * text when `url` is empty. Otherwise wrap the selection; an empty `url` is then a no-op.
 */
export function setLink(url: string): Command {
    return (view) => {
        const { state } = view
        const { from, to } = state.selection.main
        const link = linkAt(state, from, to)
        url = url.trim()
        if (link && !url) {
            const text = state.sliceDoc(link.textFrom, link.textTo)
            return run(view, {
                changes: { from: link.node.from, to: link.node.to, insert: text },
                selection: EditorSelection.range(link.node.from, link.node.from + text.length),
            })
        }
        if (link) return run(view, { changes: { from: link.urlFrom, to: link.urlTo, insert: formatUrl(url) } })
        if (!url || from === to) return false
        return run(view, {
            changes: [{ from, insert: '[' }, { from: to, insert: `](${formatUrl(url)})` }],
            selection: EditorSelection.range(from + 1, to + 1),
        })
    }
}
