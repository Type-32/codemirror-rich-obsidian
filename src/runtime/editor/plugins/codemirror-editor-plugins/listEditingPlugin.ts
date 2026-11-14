import { EditorState, Facet, Prec, Transaction, type ChangeSpec, type Line, type Text, type TransactionSpec } from '@codemirror/state'
import { keymap, type Command, type EditorView } from '@codemirror/view'
import { ensureSyntaxTree, indentUnit, syntaxTree } from '@codemirror/language'
import type { SyntaxNode, Tree } from '@lezer/common'

/**
 * List and quote editing as in Obsidian's Live Preview. Replaces `@codemirror/lang-markdown`'s keymap (wysiwyg
 * passes `addKeymap: false`): Backspace is a plain character delete, Enter continues or exits lists and quotes,
 * Shift-Enter continues an item's text on a new line, and Tab/Shift-Tab move whole items (with their children)
 * between levels. Ordered lists are renumbered on every user edit (`listRenumbering`).
 */

const QUOTE = /^(?: {0,3}> ?)*/
const ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+|$)(\[.\][ \t]+)?/
const NO_LIST: Record<string, true> = { FencedCode: true, CodeBlock: true, YAMLFrontMatter: true, TexBlock: true, HTMLBlock: true, CommentBlock: true }

interface Item {
    line: Line
    quote: string
    indent: string
    marker: string
    task: string
    /** Start of the item's text: after the mark, its spacing and a task's `[ ] `. */
    contentFrom: number
    node: SyntaxNode
}

function itemOn(state: EditorState, line: Line): Item | null {
    const quote = QUOTE.exec(line.text)![0]
    const m = ITEM.exec(line.text.slice(quote.length))
    if (!m) return null
    const markFrom = line.from + quote.length + m[1]!.length
    const mark = syntaxTree(state).resolveInner(markFrom, 1)
    if (mark.name !== 'ListMark' || mark.from !== markFrom) return null
    return { line, quote, indent: m[1]!, marker: m[2]!, task: m[4] ?? '', contentFrom: line.from + quote.length + m[0].length, node: mark.parent! }
}

function inCode(state: EditorState, pos: number) {
    for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); n; n = n.parent) {
        if (NO_LIST[n.name]) return true
    }
    return false
}

const ordinal = (marker: string) => (/^\d/.test(marker) ? parseInt(marker, 10) : null)

/** Number for an ordered item that moved under `list`'s last item (Tab): one past the sublist's last, else 1. */
function nextUnder(state: EditorState, parent: SyntaxNode) {
    const last = parent.lastChild?.name === 'OrderedList' ? parent.lastChild.lastChild?.getChild('ListMark') : null
    return last ? ordinal(state.sliceDoc(last.from, last.to))! + 1 : 1
}

/** The ordered parent item's number + 1 (Shift-Tab / exiting a nested item), or null. */
function afterParent(state: EditorState, item: SyntaxNode) {
    const parent = item.parent?.parent
    const mark = parent?.name === 'ListItem' ? parent.getChild('ListMark') : null
    const n = mark ? ordinal(state.sliceDoc(mark.from, mark.to)) : null
    return n === null ? null : n + 1
}

/** Replace a line's indentation (after quote markers) up to its list mark's digits, renumbering an ordered mark to `n`. */
function setIndentAndNumber(item: Item, indent: string, n: number | null): ChangeSpec {
    const from = item.line.from + item.quote.length
    const digits = n !== null && ordinal(item.marker) !== null
    const to = from + item.indent.length + (digits ? item.marker.length - 1 : 0)
    return { from, to, insert: indent + (digits ? String(n) : '') }
}

const dropUnit = (indent: string) => indent.replace(/(\t| {1,4})$/, '')

function dispatch(view: EditorView, spec: TransactionSpec) {
    view.dispatch(view.state.update(spec, { scrollIntoView: true }))
    return true
}

/** Enter: split or exit a list item, continue or exit a quote, clear a whitespace-only line. */
export const insertListNewline: Command = (view) => {
    const { state } = view
    const sel = state.selection.main
    if (state.selection.ranges.length > 1 || !sel.empty || inCode(state, sel.head)) return false
    const line = state.doc.lineAt(sel.head)
    const item = itemOn(state, line)
    if (item) {
        if (sel.head < item.contentFrom) return false
        if (item.contentFrom === line.to) {
            // Empty item: a nested one moves up a level, a top-level one ends the list.
            if (!item.indent) return dispatch(view, { changes: { from: line.from + item.quote.length, to: line.to }, userEvent: 'delete' })
            const change = setIndentAndNumber(item, dropUnit(item.indent), afterParent(state, item.node) ?? 1)
            return dispatch(view, { changes: change, userEvent: 'delete.dedent' }) // the cursor, at the line end, maps along
        }
        const n = ordinal(item.marker)
        const marker = n === null ? item.marker : `${n + 1}${item.marker.slice(-1)}`
        const insert = `\n${item.quote}${item.indent}${marker} ${item.task ? '[ ] ' : ''}`
        return dispatch(view, { changes: { from: sel.head, insert }, selection: { anchor: sel.head + insert.length }, userEvent: 'input' })
    }
    const quote = QUOTE.exec(line.text)![0]
    if (quote && sel.head >= line.from + quote.length) {
        // An empty quote line ends the quote, leaving a blank line so the next paragraph doesn't join it.
        if (!line.text.slice(quote.length).trim()) return dispatch(view, { changes: { from: line.from, to: line.to, insert: '\n' }, selection: { anchor: line.from + 1 }, userEvent: 'input' })
        const insert = `\n${quote}`
        return dispatch(view, { changes: { from: sel.head, insert }, selection: { anchor: sel.head + insert.length }, userEvent: 'input' })
    }
    if (line.length && !line.text.trim()) return dispatch(view, { changes: { from: line.from, to: line.to }, userEvent: 'delete' })
    return false
}

/** Shift-Enter in a list item: a new line inside the item, indented to its text. */
export const insertListContinuation: Command = (view) => {
    const { state } = view
    const sel = state.selection.main
    if (state.selection.ranges.length > 1 || !sel.empty || inCode(state, sel.head)) return false
    const item = itemOn(state, state.doc.lineAt(sel.head))
    if (!item || sel.head < item.contentFrom) return false
    const markEnd = item.line.from + item.quote.length + item.indent.length + item.marker.length
    const width = markEnd - (item.line.from + item.quote.length + item.indent.length) + /^[ \t]*/.exec(state.sliceDoc(markEnd, item.line.to))![0].length
    const insert = `\n${item.quote}${item.indent}${' '.repeat(width)}`
    return dispatch(view, { changes: { from: sel.head, insert }, selection: { anchor: sel.head + insert.length }, userEvent: 'input' })
}

/**
 * Tab / Shift-Tab with the cursor on one line: a list item moves a level with its children (ordered marks take the
 * number of their new place); in a quote, the indentation goes after the `>`. Other lines fall through to the
 * default indent commands. The first item of a list can't be indented (it has no item to nest under).
 */
function indentItem(dir: 1 | -1): Command {
    return (view) => {
        const { state } = view
        const line = state.doc.lineAt(state.selection.main.head)
        if (state.selection.ranges.some(r => r.from < line.from || r.to > line.to) || inCode(state, line.from)) return false
        const unit = state.facet(indentUnit)
        const item = itemOn(state, line)
        if (!item) {
            const quote = QUOTE.exec(line.text)![0]
            if (!quote) return false
            const at = line.from + quote.length
            if (dir > 0) return dispatch(view, { changes: { from: at, insert: unit }, userEvent: 'input.indent' })
            const m = /^(\t| {1,4})/.exec(line.text.slice(quote.length))
            return m ? dispatch(view, { changes: { from: at, to: at + m[0].length }, userEvent: 'delete.dedent' }) : true
        }
        if (dir > 0 && item.node.prevSibling?.name !== 'ListItem') return true
        if (dir < 0 && !item.indent) return true
        const changes: ChangeSpec[] = [setIndentAndNumber(item, dir > 0 ? item.indent + unit : dropUnit(item.indent),
            dir > 0 ? nextUnder(state, item.node.prevSibling!) : afterParent(state, item.node))]
        for (let n = line.number + 1; n <= state.doc.lineAt(item.node.to).number; n++) {
            const l = state.doc.line(n)
            const at = l.from + QUOTE.exec(l.text)![0].length
            if (dir > 0) changes.push({ from: at, insert: unit })
            else {
                const m = /^(\t| {1,4})/.exec(state.sliceDoc(at, l.to))
                if (m) changes.push({ from: at, to: at + m[0].length })
            }
        }
        return dispatch(view, { changes, userEvent: dir > 0 ? 'input.indent' : 'delete.dedent' })
    }
}

export const indentListItem = indentItem(1)
export const outdentListItem = indentItem(-1)

/** Renumber ordered lists after user edits (default on). `listRenumbering.of(false)` turns it off. */
export const listRenumbering = Facet.define<boolean, boolean>({ combine: values => values[0] ?? true })

/** The run of ordered lists `list` belongs to: siblings separated only by blank lines, whatever their delimiter. */
function chainOf(list: SyntaxNode, doc: Text): SyntaxNode[] {
    let first = list
    for (let p = first.prevSibling; p?.name === 'OrderedList' && !doc.sliceString(p.to, first.from).trim(); p = first.prevSibling) first = p
    const out = [first]
    for (let n = first.nextSibling; n?.name === 'OrderedList' && !doc.sliceString(out.at(-1)!.to, n.from).trim(); n = n.nextSibling) out.push(n)
    return out
}

function renumberChanges(state: EditorState, tree: Tree, positions: number[]): ChangeSpec[] {
    const starts = new Set<number>()
    const changes: ChangeSpec[] = []
    for (const pos of positions) {
        for (const side of [-1, 1] as const) {
            for (let n: SyntaxNode | null = tree.resolveInner(pos, side); n; n = n.parent) {
                if (n.name !== 'OrderedList') continue
                const chain = chainOf(n, state.doc)
                if (starts.has(chain[0]!.from)) continue
                starts.add(chain[0]!.from)
                const marks = chain.flatMap(l => l.getChildren('ListItem')).map(i => i.getChild('ListMark')!).filter(Boolean)
                const first = ordinal(state.sliceDoc(marks[0]!.from, marks[0]!.to))!
                marks.forEach((m, i) => {
                    const text = state.sliceDoc(m.from, m.to)
                    const want = `${first + i}${text.slice(-1)}`
                    if (text !== want) changes.push({ from: m.from, to: m.to, insert: want })
                })
            }
        }
    }
    return changes
}

/**
 * Obsidian's numbering: after a user edit, every ordered list it touched (at each level up from the edit) is
 * numbered in sequence from its first item. Lists split only by blank lines, or by a change of `.`/`)`, count as
 * one. Undo/redo and programmatic changes (no user event) are left alone, so loading a note never rewrites it.
 * The fixes join the same transaction, so one undo reverts both.
 */
const renumberFilter = EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged || !tr.annotation(Transaction.userEvent) || tr.isUserEvent('undo') || tr.isUserEvent('redo') || !tr.startState.facet(listRenumbering)) return tr
    const positions: number[] = []
    tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => positions.push(fromB, toB))
    const tree = ensureSyntaxTree(tr.state, Math.min(tr.state.doc.length, Math.max(...positions) + 2000), 50)
    if (!tree) return tr
    const changes = renumberChanges(tr.state, tree, positions)
    return changes.length ? [tr, { changes, sequential: true }] : tr
})

export const listEditing = [
    renumberFilter,
    Prec.high(keymap.of([
        { key: 'Enter', run: insertListNewline, shift: insertListContinuation },
        { key: 'Tab', run: indentListItem, shift: outdentListItem },
    ])),
]
