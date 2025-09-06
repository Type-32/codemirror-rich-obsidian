import { Decoration, EditorView } from '@codemirror/view';
import { StateField, RangeSet } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range as EditorRange } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import { cursorInNode, cursorSelectionCoveredNode } from '../../utility/tools'

function isCursorOnLine(state: EditorState, lineStart: number, lineEnd: number): boolean {
    const cursor = state.selection.main;
    return cursor.from >= lineStart && cursor.from <= lineEnd;
}

function buildQuoteblockDecorations(state: EditorState): EditorRange<Decoration>[] {
    const decorations: EditorRange<Decoration>[] = [];

    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'Blockquote') {
                // Get all lines in this blockquote
                const firstLine = state.doc.lineAt(node.from);
                const lastLine = state.doc.lineAt(node.to);
                const lineCount = lastLine.number - firstLine.number + 1;

                const [cursor] = state.selection.ranges
                const cursorFrom = cursor?.from || 0,
                    cursorTo = cursor?.to || 0,
                    nodeFrom = node.from || 0,
                    nodeTo = node.to || 0

                // Process each line in the blockquote
                for (let i = firstLine.number; i <= lastLine.number; i++) {
                    const line = state.doc.line(i);
                    let lineClass = 'cm-quoteblock';

                    // Determine line position styling
                    if (lineCount === 1) {
                        lineClass += ' cm-quoteblock-single';
                    } else if (i === firstLine.number) {
                        lineClass += ' cm-quoteblock-start';
                    } else if (i === lastLine.number) {
                        lineClass += ' cm-quoteblock-end';
                    } else {
                        lineClass += ' cm-quoteblock-middle';
                    }

                    // Add line-level decoration
                    decorations.push(
                        Decoration.line({
                            attributes: { class: lineClass }
                        }).range(line.from)
                    );

                    // Check if cursor is on this line
                    const isCursorActive = isCursorOnLine(state, line.from, line.to) || cursorSelectionCoveredNode(cursorFrom, cursorTo, nodeFrom, nodeTo);

                    // Style the quote marks and content on this line
                    const lineText = line.text;
                    const markMatch = lineText.match(/^(\s*>+)/);

                    if (markMatch) {
                        const markEnd = line.from + markMatch[0].length;
                        let markClass = 'cm-formatting cm-formatting-quote cm-meta';

                        // Add active class if cursor is on this line
                        if (isCursorActive) {
                            markClass += ' cm-formatting-quote-active';
                        }

                        // Style the quote mark(s)
                        decorations.push(
                            Decoration.mark({
                                class: markClass
                            }).range(line.from, markEnd)
                        );

                        // Style content after marks (if any)
                        if (markEnd < line.to) {
                            decorations.push(
                                Decoration.mark({
                                    class: 'cm-quote'
                                }).range(markEnd, line.to)
                            );
                        }
                    }
                }

                return false; // Don't process children
            }
        }
    });

    return decorations;
}

export const proseQuoteblockCodemirrorViewPlugin = StateField.define<DecorationSet>({
    create(state) {
        return RangeSet.of(buildQuoteblockDecorations(state), true);
    },
    update(value, tr) {
        if (tr.docChanged || tr.selection) {
            return RangeSet.of(buildQuoteblockDecorations(tr.state), true);
        }
        return value.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f)
});
