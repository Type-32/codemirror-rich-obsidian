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

                // 2. Formatting span wrapping the list marker (ListMark +
                //    trailing space). Emitted for BOTH unordered and ordered
                //    list items; the kind-specific class lets CSS apply
                //    different rendering:
                //    - UL: span collapses to fixed-width bullet slot, raw
                //      text hidden, `•` rendered via ::before pseudo.
                //    - OL: span reserves fixed min-width, raw `1.` / `2.`
                //      text stays visible and right-aligned inside the slot.
                //    Skipped only for task items (the checkbox widget from
                //    proseTaskListPlugin owns this range).
                if (listMark && !task) {
                    const markFrom = Math.max(0, Math.min(listMark.from, docLength))
                    const markTo = Math.max(
                        markFrom,
                        Math.min(listMark.to + 1, docLength, line.to)
                    )
                    if (markFrom < markTo) {
                        const kindSuffix = isOrdered ? 'ol' : 'ul'
                        builder.add(
                            markFrom,
                            markTo,
                            Decoration.mark({
                                class: `cm-list-formatting cm-list-formatting-${kindSuffix} cm-list-formatting-${level}`,
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

/**
 * Companion plugin that highlights the "active" indent guide on list lines
 * belonging to the nesting group containing the current cursor.
 *
 * When the cursor is on a list line at level K >= 1:
 *   - The K-th indent guide (drawn at x = (K-1)*list-indent + bullet-width)
 *     is the deepest ancestor's guide column.
 *   - All contiguous list lines above and below the cursor whose nesting
 *     level is >= K belong to the same ancestor group (they share the
 *     cursor's level-(K-1) ancestor). These lines receive a class
 *     `cm-list-line-active-guide` plus `cm-list-line-active-guide-N` where
 *     N = K - 1 (the INDEX of the guide to highlight).
 *
 * CSS in editor.css layers a second `background-image` on these lines that
 * draws ONLY the N-th stripe at full opacity in the primary guide color,
 * overlaying the dim default stripe.
 *
 * Like `proseListEditMarkPlugin`, this plugin emits ONLY line-level classes
 * (no inline marks), so it doesn't alter inline-rect geometry and can safely
 * rebuild on `selectionSet` without affecting CodeMirror's `posAtCoords`.
 */
function buildActiveGuideDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()
    const { state } = view
    const { selection } = state

    if (!selection?.main) return builder.finish()
    const cursorPos = selection.main.from

    // Find which list line (if any) the cursor is on, and its nesting level.
    const cursorLine = state.doc.lineAt(cursorPos)
    let cursorLevel = -1
    {
        // Walk the syntax tree at cursor to see if we're inside a ListItem
        const cursorTree = syntaxTree(state)
        let node = cursorTree.resolveInner(cursorPos, -1)
        let insideListItem = false
        for (let cur: typeof node | null = node; cur; cur = cur.parent) {
            if (cur.name === 'ListItem') {
                insideListItem = true
                break
            }
        }
        if (insideListItem) {
            cursorLevel = getListNestingLevel(cursorLine.text)
        }
    }

    // If cursor isn't on a list line (or is on a level-0 line), there's
    // no active guide to highlight (level 0 has no ancestor guides).
    if (cursorLevel < 1) return builder.finish()

    // The guide index to highlight is cursorLevel - 1 (the DEEPEST ancestor
    // column, which visually "connects" the current line to its siblings).
    const activeGuideIndex = cursorLevel - 1

    // Walk outward from the cursor line, collecting all contiguous list
    // lines whose nesting level >= cursorLevel. Those lines share the same
    // cursor-level-(K-1) ancestor.
    //
    // We iterate the doc line-by-line. A line is considered "in the group" if:
    //   - it is a list line (has a ListItem starting on it or continuing
    //     into it), AND
    //   - its nesting level (leading tab/4-space count) >= cursorLevel.
    //
    // We determine "is a list line" by checking if the syntax tree at
    // line.from has a ListItem ancestor. This is the same check used by
    // `proseListPlugin` when emitting `.cm-list-line`.

    const tree = syntaxTree(state)
    const isListLine = (lineFrom: number): boolean => {
        // Resolve at line start; if we're inside a ListItem, it's a list line.
        let n = tree.resolveInner(lineFrom, 1)
        for (let cur: typeof n | null = n; cur; cur = cur.parent) {
            if (cur.name === 'ListItem') return true
        }
        return false
    }

    const groupLines: Array<{ from: number }> = [{ from: cursorLine.from }]

    // Walk upward
    {
        let from = cursorLine.from
        while (from > 0) {
            const prev = state.doc.lineAt(from - 1)
            const prevLevel = getListNestingLevel(prev.text)
            if (prevLevel >= cursorLevel && isListLine(prev.from)) {
                groupLines.push({ from: prev.from })
                from = prev.from
            } else {
                break
            }
        }
    }

    // Walk downward
    {
        let to = cursorLine.to
        while (to < state.doc.length) {
            const next = state.doc.lineAt(to + 1)
            const nextLevel = getListNestingLevel(next.text)
            if (nextLevel >= cursorLevel && isListLine(next.from)) {
                groupLines.push({ from: next.from })
                to = next.to
            } else {
                break
            }
        }
    }

    // Add line decorations in ascending `from` order (required by RangeSetBuilder).
    groupLines
        .sort((a, b) => a.from - b.from)
        .forEach(({ from }) => {
            builder.add(
                from,
                from,
                Decoration.line({
                    attributes: {
                        class: `cm-list-line-active-guide cm-list-line-active-guide-${activeGuideIndex}`,
                        style: `--active-guide-index: ${activeGuideIndex}`,
                    },
                })
            )
        })

    return builder.finish()
}

export const proseListActiveGuidePlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = buildActiveGuideDecorations(view)
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = buildActiveGuideDecorations(update.view)
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    }
)

