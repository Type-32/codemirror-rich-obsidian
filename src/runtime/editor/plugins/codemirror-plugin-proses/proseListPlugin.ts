import {
    Decoration,
    type DecorationSet,
    EditorView,
    ViewPlugin,
    type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { isNodeRangeActive } from '../../utility/tools'

/**
 * Returns the nesting depth of a list line (0 for top-level).
 * Each tab or 4-space group counts as one nesting level.
 */
function getListNestingLevel(lineText: string): number {
    const match = lineText.match(/^(?:\t| {4})*/)
    if (!match) return 0
    const prefix = match[0]
    let level = 0
    let i = 0
    while (i < prefix.length) {
        if (prefix[i] === '\t') {
            level++
            i++
        } else if (prefix.slice(i, i + 4) === '    ') {
            level++
            i += 4
        } else {
            break
        }
    }
    return level
}

/**
 * Prose plugin responsible for Obsidian-style list rendering:
 *   - Adds `cm-list-line` class + `--indent-level` CSS var to each list line
 *     for hanging-indent styling (see editor.css `.cm-list-line`).
 *   - Wraps the bullet ListMark (+ trailing space) in
 *     `<span class="cm-list-formatting cm-list-formatting-ul cm-list-formatting-N">`
 *     for UL lists. CSS collapses the wrapped text to zero visible width via
 *     `font-size: 0`, and renders the visible `•` through a `::before`
 *     pseudo-element in a fixed-width slot. This preserves the real text nodes
 *     in the DOM so CodeMirror's `posAtCoords` scanning (which walks text rects)
 *     continues to work — replacing the range with a widget or using
 *     `display: none` on the children both trigger the "side is undefined"
 *     crash in CM's coord-to-pos lookup.
 *   - Wraps the line's content in `<span class="cm-list-content cm-list-content-N">`,
 *     providing a DOM hook for per-nesting-level styling, matching the
 *     structural convention Obsidian uses (`.cm-list-N`).
 *
 * This plugin REPLACES the deprecated `indentationListPlugin` and the
 * `ListMark -> decorationBullet` logic previously in `richTextPlugin.ts`.
 */
function buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()
    const { state } = view
    const docLength = state.doc.length
    const seenLines = new Set<number>()

    for (const { from, to } of view.visibleRanges) {
        syntaxTree(state).iterate({
            from,
            to,
            enter: (node) => {
                if (node.name !== 'ListItem') return

                const line = state.doc.lineAt(node.from)
                if (seenLines.has(line.from)) return
                seenLines.add(line.from)

                const level = getListNestingLevel(line.text)
                const parentName = node.node.parent?.type.name
                const isOrdered = parentName === 'OrderedList'
                const listKindClass = isOrdered ? 'cm-list-line-ol' : 'cm-list-line-ul'

                // 1. Line decoration — hanging indent via CSS vars
                builder.add(
                    line.from,
                    line.from,
                    Decoration.line({
                        attributes: {
                            class: `cm-list-line cm-list-line-${level} ${listKindClass}`,
                            style: `--indent-level: ${level}`,
                        },
                    })
                )

                // Resolve child nodes (ListMark, optional Task)
                const listMark = node.node.getChild('ListMark')
                const task = node.node.getChild('Task')
                const taskMarker = task?.getChild('TaskMarker')

                // 2. Formatting span wrapping ListMark + trailing space for
                //    BULLET lists only. Skipped for:
                //    - ordered lists (raw `1.`, `2.` render naturally)
                //    - task items (checkbox widget from proseTaskListPlugin owns this range)
                //    - when cursor is inside the ListMark range (reveal raw `-` for editing)
                if (listMark && !isOrdered && !task) {
                    const markFrom = Math.max(0, Math.min(listMark.from, docLength))
                    const markTo = Math.max(
                        markFrom,
                        Math.min(listMark.to + 1, docLength, line.to)
                    )
                    if (
                        markFrom < markTo &&
                        !isNodeRangeActive(state, listMark.from, listMark.to)
                    ) {
                        builder.add(
                            markFrom,
                            markTo,
                            Decoration.mark({
                                class: `cm-list-formatting cm-list-formatting-ul cm-list-formatting-${level}`,
                                tagName: 'span',
                            })
                        )
                    }
                }

                // 3. Content span — wraps the line's content after the marker.
                //    For task items, content starts after the TaskMarker (e.g. after `[ ] `).
                //    For regular items, content starts after the ListMark + space.
                let contentFrom: number
                if (taskMarker) {
                    contentFrom = taskMarker.to
                    if (state.doc.sliceString(contentFrom, contentFrom + 1) === ' ') {
                        contentFrom += 1
                    }
                } else if (listMark) {
                    contentFrom = listMark.to
                    if (state.doc.sliceString(contentFrom, contentFrom + 1) === ' ') {
                        contentFrom += 1
                    }
                } else {
                    contentFrom = line.from
                }

                const contentEnd = Math.min(line.to, docLength)
                contentFrom = Math.max(0, Math.min(contentFrom, contentEnd, docLength))

                if (contentFrom < contentEnd) {
                    builder.add(
                        contentFrom,
                        contentEnd,
                        Decoration.mark({
                            class: `cm-list-content cm-list-content-${level}`,
                            tagName: 'span',
                        })
                    )
                }
            },
        })
    }

    return builder.finish()
}

export const proseListPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = buildDecorations(view)
        }

        update(update: ViewUpdate) {
            // Rebuild on doc changes, viewport changes, or selection changes.
            // Selection matters because the formatting span is hidden when the
            // cursor enters the ListMark range (so the raw `-` can be edited).
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = buildDecorations(update.view)
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    }
)
