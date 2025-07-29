import {Decoration, type DecorationSet, EditorView} from '@codemirror/view';
import { StateField, RangeSet } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range as EditorRange } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import {
    decorationProseInternalLink,
    decorationProseInternalPath,
    decorationProseInternalSubpath
} from "~/editor/utility/decorations";

function isNodeRangeActive(state: EditorState, nodeFrom: number, nodeTo: number): boolean {
    const cursor = state.selection.main;
    if (cursor.empty) {
        return cursor.from >= nodeFrom && cursor.from <= nodeTo;
    } else {
        return Math.max(nodeFrom, cursor.from) < Math.min(nodeTo, cursor.to);
    }
}

function buildInternalLinkDecorations(state: EditorState): EditorRange<Decoration>[] {
    const decorations: EditorRange<Decoration>[] = [];

    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'InternalLink' || node.name === 'Embed') {
                const mainNode = node.node; // The InternalLink or Embed node
                const mainNodeFrom = mainNode.from;
                const mainNodeTo = mainNode.to;

                const isActive = isNodeRangeActive(state, mainNodeFrom, mainNodeTo);

                if (!isActive) {
                    let hasAlias = false;
                    let aliasNode: SyntaxNode | null = null;
                    let pathToHide: SyntaxNode | null = null;
                    let subpathToHide: SyntaxNode | null = null;

                    // Determine the node that actually contains Path, Subpath, Display
                    let contentContainerNode: SyntaxNode | null = null;
                    if (mainNode.name === 'InternalLink') {
                        contentContainerNode = mainNode;
                    } else if (mainNode.name === 'Embed') {
                        // For Embed, the Path/Subpath/Display are inside its InternalLink child
                        contentContainerNode = mainNode.getChild('InternalLink');
                    }

                    if (contentContainerNode) {
                        // Find InternalDisplay (alias)
                        contentContainerNode.getChildren('InternalDisplay').forEach(child => {
                            aliasNode = child;
                            hasAlias = true;
                        });

                        if (hasAlias && aliasNode) {
                            // Alias exists, find Path and Subpath to hide
                            contentContainerNode.getChildren('InternalPath').forEach(pathN => {
                                pathToHide = pathN;
                            });
                            contentContainerNode.getChildren('InternalSubpath').forEach(subpathN => {
                                subpathToHide = subpathN;
                            });

                            if (pathToHide) {
                                decorations.push(decorationProseInternalPath.range((pathToHide as SyntaxNode).from, (pathToHide as SyntaxNode).to));
                            }
                            if (subpathToHide) {
                                decorations.push(decorationProseInternalSubpath.range((subpathToHide as SyntaxNode).from, (subpathToHide as SyntaxNode).to));
                            }
                        }
                    }
                }
                return false;
            }
        }
    });

    return decorations;
}

export const proseInternalLinkCodemirrorViewPlugin = StateField.define<DecorationSet>({
    create(state) {
        return RangeSet.of(buildInternalLinkDecorations(state), true);
    },
    update(value, tr) {
        if (tr.docChanged || tr.selection) {
            return RangeSet.of(buildInternalLinkDecorations(tr.state), true);
        }
        return value.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f)
});
