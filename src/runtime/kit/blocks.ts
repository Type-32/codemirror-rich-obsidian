import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { ChangeSet, type ChangeSpec, type EditorState, type Text } from '@codemirror/state'
import type { Command } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'

/**
 * A draggable unit of the document: the innermost list item (with its nested children), or a
 * top-level block. A blockquote, callouts included, is always one block. `from` is the start of the
 * block's first line; `to` the end of its last.
 */
export interface Block {
    from: number
    to: number
    name: string
}

export type Side = 'before' | 'after'

const isList = (n: SyntaxNode) => n.name === 'BulletList' || n.name === 'OrderedList'

function nodeAtPos(state: EditorState, pos: number): SyntaxNode | null {
    const tree = syntaxTree(state)
    // At a line end, side 1 resolves to the newline after the block; fall back to the left side.
    let start = tree.resolveInner(pos, 1)
    if (!start.parent) start = tree.resolveInner(pos, -1)
    let item: SyntaxNode | null = null
    for (let n: SyntaxNode | null = start; n?.parent; n = n.parent) {
        if (!item && n.name === 'ListItem') item = n
        if (n.parent.name !== 'Document') continue
        if (n.name === 'YAMLFrontMatter') return null
        if (n.name === 'Blockquote') return n
        return isList(n) ? item : n
    }
    return null
}

const lineStart = (doc: Text, pos: number) => doc.lineAt(pos).from
const indentOf = (doc: Text, n: SyntaxNode) => /^\s*/.exec(doc.lineAt(n.from).text)![0]
const toBlock = (state: EditorState, n: SyntaxNode): Block => ({ from: lineStart(state.doc, n.from), to: n.to, name: n.name })

/** The block at `pos`, or null on blank lines and frontmatter (which is pinned). */
export function blockAt(state: EditorState, pos: number): Block | null {
    const n = nodeAtPos(state, pos)
    return n && toBlock(state, n)
}

/** Re-resolve a (possibly stale) block in `state`; null when nothing starts on that line anymore. */
function nodeOf(state: EditorState, block: Block): SyntaxNode | null {
    if (block.from > state.doc.length) return null
    const line = state.doc.lineAt(block.from)
    const n = nodeAtPos(state, line.from + /^\s*/.exec(line.text)![0].length)
    return n && lineStart(state.doc, n.from) === block.from ? n : null
}

/** Previous/next block at the same level: a list item in the same list, or a top-level block. */
function sibling(n: SyntaxNode, dir: -1 | 1): SyntaxNode | null {
    const s = dir < 0 ? n.prevSibling : n.nextSibling
    if (n.name === 'ListItem') return s?.name === 'ListItem' ? s : null
    return s && s.name !== 'YAMLFrontMatter' ? s : null
}

/** The top-level node containing `n`. */
function topLevel(n: SyntaxNode): SyntaxNode {
    while (n.parent && n.parent.name !== 'Document') n = n.parent
    return n
}

interface Move { d: SyntaxNode, t: SyntaxNode, listMode: boolean }

/**
 * Validate a move. Item → item moves are sibling insertions (list mode); everything else moves
 * between top-level blocks, a target list item standing for its whole list.
 */
function resolveMove(state: EditorState, block: Block, target: Block, side: Side): Move | null {
    const d = nodeOf(state, block), t0 = nodeOf(state, target)
    if (!d || !t0) return null
    const listMode = d.name === 'ListItem' && t0.name === 'ListItem'
    const t = listMode ? t0 : topLevel(t0)
    if (t.from >= d.from && t.to <= d.to) return null // onto itself or into its own subtree
    const neighbour = sibling(d, side === 'before' ? 1 : -1) // already there: no-op
    if (neighbour && neighbour.from === t.from && neighbour.to === t.to) return null
    return { d, t, listMode }
}

/**
 * Where dropping `block` before/after `target` would land: `target` itself, or its whole list when a
 * non-item is dropped onto a list item. Null when the drop is a no-op or into the block's own subtree.
 */
export function dropTarget(state: EditorState, block: Block, target: Block, side: Side): Block | null {
    const move = resolveMove(state, block, target, side)
    return move && toBlock(state, move.t)
}

/** Removing a top-level range leaves exactly one blank line between its neighbours. */
function removeTopLevel(doc: Text, from: number, to: number): ChangeSpec {
    const first = doc.lineAt(from).number, last = doc.lineAt(to).number
    let p = first - 1
    while (p >= 1 && !doc.line(p).text.trim()) p--
    let n = last + 1
    while (n <= doc.lines && !doc.line(n).text.trim()) n++
    const hasPrev = p >= 1, hasNext = n <= doc.lines
    if (hasPrev && hasNext) return { from: doc.line(p).to, to: doc.line(n).from, insert: '\n\n' }
    if (hasNext) return { from: doc.line(first).from, to: doc.line(n).from }
    if (hasPrev) return { from: doc.line(p).to, to: doc.line(last).to }
    return { from: doc.line(first).from, to: doc.line(last).to }
}

/** Remove a block: list items take their sibling separator; an only child takes its list. */
function removal(state: EditorState, d: SyntaxNode): ChangeSpec {
    const { doc } = state
    if (d.name !== 'ListItem') return removeTopLevel(doc, d.from, d.to)
    const next = sibling(d, 1), prev = sibling(d, -1)
    if (next) return { from: lineStart(doc, d.from), to: lineStart(doc, next.from) }
    if (prev) return { from: prev.to, to: d.to }
    const list = d.parent!
    if (list.parent?.name === 'Document') return removeTopLevel(doc, list.from, list.to)
    return { from: lineStart(doc, list.from) - 1, to: list.to } // nested only child: drop its lines
}

/** Separator used between items of `item`'s list (tight `\n` or loose `\n\n`). */
function itemSeparator(doc: Text, item: SyntaxNode): string {
    const next = sibling(item, 1), prev = sibling(item, -1)
    if (next) return doc.sliceString(item.to, lineStart(doc, next.from))
    if (prev) return doc.sliceString(prev.to, lineStart(doc, item.from))
    return '\n'
}

/** `d`'s text re-indented to `indent`, with its list mark replaced by `mark` (if given). */
function rebase(doc: Text, d: SyntaxNode, indent: string, mark?: string): string {
    const old = indentOf(doc, d)
    const lines = doc.sliceString(lineStart(doc, d.from), d.to).split('\n')
        .map(l => (l.startsWith(old) ? indent + l.slice(old.length) : l))
    const dMark = d.getChild('ListMark')
    if (mark !== undefined && dMark) lines[0] = indent + mark + lines[0]!.slice(indent.length + dMark.to - dMark.from)
    return lines.join('\n')
}

interface MarkFix { from: number, to: number, insert: string }

/** First number of an ordered list, or undefined for bullet lists. */
function listStart(state: EditorState, list: SyntaxNode | null): number | undefined {
    const mark = list?.name === 'OrderedList' ? list.getChild('ListItem')?.getChild('ListMark') : null
    return mark ? parseInt(state.sliceDoc(mark.from, mark.to), 10) : undefined
}

/** Renumber the ordered list (if any) whose item mark sits at `pos`, from `start` (default: its first number). */
function renumber(state: EditorState, pos: number, start?: number): MarkFix[] {
    let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1)
    while (n && n.name !== 'ListItem') n = n.parent
    const list = n?.parent ?? null
    const first = listStart(state, list)
    if (first === undefined) return []
    return list!.getChildren('ListItem').flatMap((item, i) => {
        const m = item.getChild('ListMark')!
        const text = state.sliceDoc(m.from, m.to)
        const want = `${(start ?? first) + i}${text.slice(-1)}`
        return text === want ? [] : [{ from: m.from, to: m.to, insert: want }]
    })
}

/** A list item mark position in the changed document, and the number its list should start from. */
type Renumber = [pos: number, start?: number]

/** Compose `changes` with renumbering of the ordered lists containing the given item marks. */
function withRenumbering(state: EditorState, changes: ChangeSet, lists: Renumber[]): ChangeSet {
    const after = state.update({ changes }).state
    ensureSyntaxTree(after, after.doc.length, 200)
    const fixes = lists.flatMap(([pos, start]) => renumber(after, pos, start))
    // Both marks can sit in the same list; keep each fix once.
    const unique = fixes.filter((f, i) => fixes.findIndex(g => g.from === f.from) === i)
    return changes.compose(ChangeSet.of(unique, after.doc.length))
}

/**
 * The item that takes a removed list item's place, as a renumber entry: its mark position and its
 * list's original start, so removing the first item of a `1.` list doesn't restart it at `2.`.
 */
function survivor(state: EditorState, d: SyntaxNode): Renumber | null {
    if (d.name !== 'ListItem') return null
    const s = sibling(d, 1) ?? sibling(d, -1)
    return s ? [s.from, listStart(state, d.parent)] : null
}

/**
 * Move `block` before/after `target` as one undoable change. Item → item: becomes a sibling of the
 * target, re-indented, adopting its list mark and separator. Otherwise top-level: a target item
 * stands for its whole list, a moved item becomes a standalone list, and blank lines are padded on
 * both sides so neighbouring paragraphs/quotes/callouts never fuse. Ordered lists are renumbered.
 *
 * ponytail: drops always land as a sibling (no nesting by horizontal offset), and a mark of a
 * different width (`-` → `10.`) doesn't re-align children's continuation indentation.
 */
export function moveBlockTo(block: Block, target: Block, side: Side): Command {
    return (view) => {
        const { state } = view
        const move = resolveMove(state, block, target, side)
        if (!move) return false
        const { d, t, listMode } = move
        const { doc } = state

        const del = state.changes(removal(state, d))
        const doc1 = del.apply(doc)
        const at = side === 'before' ? del.mapPos(lineStart(doc, t.from), 1) : del.mapPos(t.to, -1)
        let text: string, insert: string
        if (listMode) {
            const tMark = t.getChild('ListMark')!
            text = rebase(doc, d, indentOf(doc, t), doc.sliceString(tMark.from, tMark.to))
            const sep = itemSeparator(doc, t)
            insert = side === 'before' ? text + sep : sep + text
        }
        else {
            const dMark = d.name === 'ListItem' ? d.getChild('ListMark') : null
            // A standalone ordered item restarts at 1 rather than keeping its old position number.
            const mark = dMark && /^\d/.test(doc.sliceString(dMark.from, dMark.to)) ? `1${doc.sliceString(dMark.to - 1, dMark.to)}` : undefined
            text = d.name === 'ListItem' ? rebase(doc, d, '', mark) : doc.sliceString(lineStart(doc, d.from), d.to)
            const line = doc1.lineAt(at)
            if (side === 'before') {
                const prevFilled = line.number > 1 && !!doc1.line(line.number - 1).text.trim()
                insert = (prevFilled ? '\n' : '') + text + '\n\n'
            }
            else {
                const nextFilled = line.number < doc1.lines && !!doc1.line(line.number + 1).text.trim()
                insert = '\n\n' + text + (nextFilled ? '\n' : '')
            }
        }
        const ins = ChangeSet.of({ from: at, insert }, doc1.length)
        const moved = del.compose(ins)
        // Renumber the list the item landed in (from its original start) and the one it left.
        const movedMark = at + insert.indexOf(text) + /^\s*/.exec(text)![0].length
        const lists: Renumber[] = [[movedMark, listMode ? listStart(state, t.parent) : undefined]]
        const left = survivor(state, d)
        if (left) lists.push([ins.mapPos(del.mapPos(left[0], 1), 1), left[1]])
        const changes = withRenumbering(state, moved, lists)
        view.dispatch({ changes, userEvent: 'move.drop' })
        return true
    }
}

/** True if `block` has a sibling to swap with in direction `dir`. */
export function canMoveBlock(state: EditorState, block: Block, dir: -1 | 1): boolean {
    const d = nodeOf(state, block)
    return !!(d && sibling(d, dir))
}

/** Swap `block` with its previous (`-1`) or next (`1`) sibling. See `moveBlockTo`. */
export function moveBlock(block: Block, dir: -1 | 1): Command {
    return (view) => {
        const d = nodeOf(view.state, block)
        const s = d && sibling(d, dir)
        return !!s && moveBlockTo(block, toBlock(view.state, s), dir < 0 ? 'before' : 'after')(view)
    }
}

/** Delete `block`, collapsing the gap it leaves; ordered lists are renumbered. */
export function deleteBlock(block: Block): Command {
    return (view) => {
        const { state } = view
        const d = nodeOf(state, block)
        if (!d) return false
        const del = state.changes(removal(state, d))
        const left = survivor(state, d)
        const changes = left ? withRenumbering(state, del, [[del.mapPos(left[0], 1), left[1]]]) : del
        view.dispatch({ changes, userEvent: 'delete' })
        return true
    }
}
