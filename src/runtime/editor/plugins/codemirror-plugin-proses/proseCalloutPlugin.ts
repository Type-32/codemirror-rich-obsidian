import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { StateField, RangeSet } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range as EditorRange, SelectionRange } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { CalloutWidget } from '../codemirror-widgets/proseCalloutWidget'

function isNodeRangeActive(state: EditorState, nodeFrom: number, nodeTo: number): boolean {
    const cursor = state.selection.main;
    if (cursor.empty) {
        return cursor.from >= nodeFrom && cursor.from <= nodeTo;
    }
    return Math.max(nodeFrom, cursor.from) < Math.min(nodeTo, cursor.to);
}

/**
 * Finds all Blockquote node ranges that contain Callout nodes in the syntax tree
 */
function getCalloutBlockquoteRanges(state: EditorState): Array<{ from: number, to: number }> {
    const ranges: Array<{ from: number, to: number }> = []
    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'Blockquote') {
                const calloutNode = getCalloutNode(node.node);
                // Only add blockquotes that have callouts and are outermost
                if (calloutNode && node.node.parent?.name !== 'Blockquote') {
                    ranges.push({ from: node.from, to: node.to })
                    return false // Don't descend into children
                }
            }
        }
    })
    return ranges
}

/**
 * Checks if cursor is inside any of the given ranges
 */
function isCursorInAnyRange(cursor: SelectionRange, ranges: Array<{ from: number, to: number }>): boolean {
    return ranges.some(range => 
        (cursor.from >= range.from && cursor.from <= range.to) ||
        (cursor.to >= range.from && cursor.to <= range.to) ||
        (cursor.from <= range.from && cursor.to >= range.to)
    )
}

function getCalloutNode(blockquoteNode: SyntaxNode): SyntaxNode | null {
    let calloutNode: SyntaxNode | null = null;
    let found = false;

    blockquoteNode.cursor().iterate(node => {
        if (found) return false;
        if (node.name === 'Paragraph') {
            node.node.cursor().iterate(child => {
                if (child.name === 'Callout') {
                    calloutNode = child.node;
                    found = true;
                    return false;
                }
            });
            return false;
        }
    });
    return calloutNode;
}

function buildCalloutWidgetDecorations(state: EditorState): EditorRange<Decoration>[] {
    const decorations: EditorRange<Decoration>[] = [];

    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'Blockquote') {
                const calloutNode = getCalloutNode(node.node);

                // A callout is an "outermost" callout if its parent is NOT another Blockquote.
                if (calloutNode && node.node.parent?.name !== 'Blockquote') {
                    const from = node.from;
                    const to = node.to;

                    if (!isNodeRangeActive(state, from, to)) {
                        decorations.push(Decoration.replace({
                            widget: new CalloutWidget(from, to),
                            block: true,
                        }).range(from, to));
                    }
                    // By only decorating the outermost callout, we prevent nested ranges.
                    // The widget's markdown-it renderer will handle the nested callouts.
                    // We can safely return false to stop descending into this branch.
                    return false;
                }
            }
        }
    });

    // The logic now prevents overlapping ranges by design, but sorting is a good safeguard.
    return decorations.sort((a, b) => a.from - b.from);
}

export const proseCalloutPlugin = StateField.define<DecorationSet>({
    create(state) {
        return RangeSet.of(buildCalloutWidgetDecorations(state), true);
    },
    update(oldDecorations, tr) {
        // If document changed, rebuild everything
        if (tr.docChanged) {
            return RangeSet.of(buildCalloutWidgetDecorations(tr.state), true);
        }
        
        // If only selection changed, check if cursor entered/left any callouts
        if (tr.selection) {
            const oldCursor = tr.startState.selection.main
            const newCursor = tr.state.selection.main
            
            // Get all callout blockquote ranges from syntax tree
            const calloutRanges = getCalloutBlockquoteRanges(tr.state)
            
            // Check if cursor state changed (entered or left a callout)
            const wasInCallout = isCursorInAnyRange(oldCursor, calloutRanges)
            const isInCallout = isCursorInAnyRange(newCursor, calloutRanges)
            
            // Rebuild if cursor entered or left any callout
            // CalloutWidget.eq() will prevent remounting if content hasn't changed
            if (wasInCallout !== isInCallout) {
                return RangeSet.of(buildCalloutWidgetDecorations(tr.state), true);
            }
            
            // Cursor moved but didn't cross callout boundaries
            return oldDecorations;
        }
        
        return oldDecorations.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f),
});
