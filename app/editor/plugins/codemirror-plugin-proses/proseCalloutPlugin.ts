import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { StateField, RangeSet } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range as EditorRange } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { CalloutWidget } from '~/editor/plugins/codemirror-widgets/proseCalloutWidget'

function isNodeRangeActive(state: EditorState, nodeFrom: number, nodeTo: number): boolean {
    const cursor = state.selection.main;
    if (cursor.empty) {
        return cursor.from >= nodeFrom && cursor.from <= nodeTo;
    }
    return Math.max(nodeFrom, cursor.from) < Math.min(nodeTo, cursor.to);
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
    update(value, tr) {
        if (tr.docChanged || tr.selection) {
            return RangeSet.of(buildCalloutWidgetDecorations(tr.state), true);
        }
        return value.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f),
});
