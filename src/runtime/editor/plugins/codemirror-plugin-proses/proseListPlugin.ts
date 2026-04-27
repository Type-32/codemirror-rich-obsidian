import {
    Decoration,
    type DecorationSet,
    EditorView,
    ViewPlugin,
    type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { isCursorInRange } from '../../utility/tools'

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
 * IMPORTANT: The structural decorations (line + formatting span + content span)
 * emitted by this plugin are SELECTION-INDEPENDENT. The formatting span is
 * always applied. The reveal-the-raw-`-`-when-cursor-is-on-it behavior is
 * provided by a sibling plugin `proseListEditMarkPlugin` (below) that toggles
 * a line-level class on `selectionSet`. Keeping inline-mark geometry stable
 * across selection changes is critical — otherwise DOM reflow between
 * mousedown and cursor-placement causes CodeMirror's `posAtCoords` scan to
 * mis-map the first click to the line start.
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
                if (listMark && !isOrdered && !task) {
                    const markFrom = Math.max(0, Math.min(listMark.from, docLength))
                    const markTo = Math.max(
                        markFrom,
                        Math.min(listMark.to + 1, docLength, line.to)
                    )
                    if (markFrom < markTo) {
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
            // Rebuild only on doc or viewport changes. The decoration set
            // does NOT depend on selection state (see comment in
            // buildDecorations about why we don't skip on cursor-in-range),
            // so rebuilding on `selectionSet` would just cause unnecessary
            // reflows and can disturb `posAtCoords` scanning mid-click.
            if (update.docChanged || update.viewportChanged) {
                this.decorations = buildDecorations(update.view)
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    }
)

/**
 * Companion plugin that toggles a LINE-LEVEL class on list lines whose
 * ListMark currently contains the cursor. The CSS rule
 * `.cm-list-line-editing-mark .cm-list-formatting` reveals the raw `-` text
 * (undoes the `font-size: 0` collapse) so the user can edit the bullet
 * character.
 *
 * Why a separate plugin (instead of conditionally skipping the formatting
 * decoration in `proseListPlugin`)?
 *
 * A `Decoration.mark` that toggles based on selection would cause the
 * wrapping `<span>` to appear/disappear on caret movement. That changes
 * inline geometry and triggers a DOM reflow between mousedown and
 * cursor-placement, which confuses CodeMirror's `posAtCoords` scan — the
 * first click on any list line would mis-map to line-start.
 *
 * A line decoration, by contrast, only adds/removes a CLASS on the
 * already-existing line `<div>`. Its geometry doesn't change; only the
 * cascade of CSS rules. CM's rect measurements stay valid across clicks.
 */
function buildEditMarkDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()
    const { state } = view
    const seenLines = new Set<number>()

    for (const { from, to } of view.visibleRanges) {
        syntaxTree(state).iterate({
            from,
            to,
            enter: (node) => {
                if (node.name !== 'ListItem') return

                const listMark = node.node.getChild('ListMark')
                if (!listMark) return

                // Reveal the raw `-` when the cursor is anywhere in
                // [ListMark.from, ListMark.to + 1] — which is the range our
                // formatting span covers. This lets the user click on the
                // bullet to edit it.
                const revealFrom = listMark.from
                const revealTo = Math.min(listMark.to + 1, state.doc.length)
                if (!isCursorInRange(state, [revealFrom, revealTo])) return

                const line = state.doc.lineAt(node.from)
                if (seenLines.has(line.from)) return
                seenLines.add(line.from)

                builder.add(
                    line.from,
                    line.from,
                    Decoration.line({
                        attributes: { class: 'cm-list-line-editing-mark' },
                    })
                )
            },
        })
    }

    return builder.finish()
}

export const proseListEditMarkPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = buildEditMarkDecorations(view)
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = buildEditMarkDecorations(update.view)
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    }
)
