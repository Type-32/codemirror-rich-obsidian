import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { indentLevel, markRevealed } from '../../utility/tools'

/**
 * Obsidian-style list lines. The list mark's source characters stay in the line and keep their width:
 *   - `.cm-list-line .cm-list-line-N .cm-list-line-ul|ol` on the line (N = nesting depth);
 *   - `.cm-list-formatting` on the mark (`-`, `1.`), padded by `--list-padding-inline-start`. A bullet's `-` also
 *     gets `.cm-list-bullet`: its text is transparent and a dot is drawn over it;
 *   - `.cm-list-content .cm-list-content-N` on the text after the mark (or after a task's `[ ]`).
 * Revealing a bullet (`proseListEditMarkPlugin`) only toggles a line class, so no geometry changes and clicks map
 * to the same positions in both states. Hanging indents come from `proseHangingIndentPlugin`.
 */
function buildDecorations(view: EditorView): DecorationSet {
    const { state } = view
    const out: Range<Decoration>[] = []
    const seen = new Set<number>()

    for (const { from, to } of view.visibleRanges) {
        syntaxTree(state).iterate({
            from,
            to,
            enter: (node) => {
                if (node.name !== 'ListItem') return
                const line = state.doc.lineAt(node.from)
                if (seen.has(line.from)) return
                seen.add(line.from)

                const level = indentLevel(line.text)
                const kind = node.node.parent?.name === 'OrderedList' ? 'ol' : 'ul'
                out.push(Decoration.line({ class: `cm-list-line cm-list-line-${level} cm-list-line-${kind}` }).range(line.from))

                const mark = node.node.getChild('ListMark')
                if (!mark) return
                out.push(Decoration.mark({
                    class: `cm-list-formatting cm-list-formatting-${kind} cm-list-formatting-${level}${kind === 'ul' ? ' cm-list-bullet' : ''}`,
                }).range(mark.from, mark.to))

                const markEnd = node.node.getChild('Task')?.getChild('TaskMarker')?.to ?? mark.to
                const contentFrom = markEnd + /^[ \t]?/.exec(state.sliceDoc(markEnd, line.to))![0].length
                if (contentFrom < line.to) {
                    out.push(Decoration.mark({ class: `cm-list-content cm-list-content-${level}` }).range(contentFrom, line.to))
                }
            },
        })
    }
    return Decoration.set(out, true)
}

export const proseListPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet

    constructor(view: EditorView) {
        this.decorations = buildDecorations(view)
    }

    update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) this.decorations = buildDecorations(u.view)
    }
}, { decorations: v => v.decorations })

const editingMark = Decoration.line({ class: 'cm-list-line-editing-mark' })

/**
 * `.cm-list-line-editing-mark` on list lines whose mark the cursor is on (see `markRevealed`), which shows the raw
 * `-` instead of the dot. A line class rather than a different mark keeps the inline DOM, and so click mapping, stable.
 */
function buildEditMarkDecorations(view: EditorView): DecorationSet {
    const { state } = view
    const out: Range<Decoration>[] = []
    for (const r of state.selection.ranges) {
        for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(r.head, 1); n; n = n.parent) {
            if (n.name !== 'ListItem') continue
            const mark = n.getChild('ListMark')
            if (mark && markRevealed(state, mark, n.getChild('Task')?.getChild('TaskMarker'))) out.push(editingMark.range(state.doc.lineAt(mark.from).from))
            break
        }
    }
    return Decoration.set(out, true)
}

export const proseListEditMarkPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet

    constructor(view: EditorView) {
        this.decorations = buildEditMarkDecorations(view)
    }

    update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet) this.decorations = buildEditMarkDecorations(u.view)
    }
}, { decorations: v => v.decorations })
