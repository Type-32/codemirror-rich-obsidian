/**
 * @deprecated DO NOT USE. This plugin is retained for reference only.
 *
 * List indentation and bullet/content wrapping are now handled by
 * `proseListPlugin` in `plugins/codemirror-plugin-proses/proseListPlugin.ts`,
 * which produces the correct Obsidian-style hanging-indent DOM structure:
 *   <div class="cm-list-line cm-list-line-N cm-list-line-ul">
 *     <span class="cm-list-formatting ...">- </span>
 *     <span class="cm-list-content cm-list-content-N">...</span>
 *   </div>
 *
 * This older plugin's broken implementation only emitted a line decoration
 * plus an unused `.cm-list-internal` mark — it did not wrap list content in
 * a span and did not produce a proper hanging indent on wrapped lines.
 */
import { Decoration, ViewPlugin, type DecorationSet, ViewUpdate, EditorView } from '@codemirror/view'
import { Line, RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

/**
 * Returns the nesting depth of a list line (0 for top-level).
 * Each tab or 4-space group counts as one nesting level.
 */
function getListNestingLevel(line: Line): number {
    const match = line.text.match(/^(?:\t| {4})*/)
    if (!match) return 0
    // Count tabs plus groups of 4 spaces. Mixed indents are treated per-unit.
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

function decorate(view: EditorView) {
    const builder = new RangeSetBuilder<Decoration>()
    // Track which lines we've already decorated to avoid duplicate line decorations
    // when multiple ListItem nodes share the same starting line (nested lists at the
    // same position can emit nested ListItems).
    const seenLines = new Set<number>()

    for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter: (node) => {
                if (node.name !== 'ListItem') return

                const line = view.state.doc.lineAt(node.from)
                if (seenLines.has(line.from)) return
                seenLines.add(line.from)

                const nestingLevel = getListNestingLevel(line)

                builder.add(
                    line.from,
                    line.from,
                    Decoration.line({
                        attributes: {
                            class: `cm-list-line cm-list-line-${nestingLevel}`,
                            style: `--indent-level: ${nestingLevel}`,
                        },
                    })
                )
            },
        })
    }
    return builder.finish()
}

export const indentationListPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = decorate(view)
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = decorate(update.view)
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    }
)
