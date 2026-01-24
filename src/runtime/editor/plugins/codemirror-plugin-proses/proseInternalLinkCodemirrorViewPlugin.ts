import {Decoration, type DecorationSet, EditorView} from '@codemirror/view';
import { StateField, RangeSet } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range as EditorRange, SelectionRange } from '@codemirror/state';
import {internalLinkMapFacet} from "../linkMappingConfig";
import {ProseVueComponentEmbedWidget} from "../codemirror-widgets/proseVueComponentEmbedWidget";
import { cursorSelectionCoveredNode, toCursorNodePositions, isNodeRangeActive } from '../../utility/tools'

/**
 * Finds all Embed node ranges in the syntax tree
 */
function getEmbedAndInternalLinkRanges(state: EditorState): Array<{ from: number, to: number }> {
    const ranges: Array<{ from: number, to: number }> = []
    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'Embed' || node.name === 'InternalLink') {
                ranges.push({ from: node.from, to: node.to })
                return false // Don't descend into children
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

function buildInternalLinkDecorations(state: EditorState): EditorRange<Decoration>[] {
    const decorations: EditorRange<Decoration>[] = [];
    const linkMap = state.facet(internalLinkMapFacet);
    const widgets: EditorRange<Decoration>[] = [];

    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'Embed') {
                const pathNode = node.node.getChild('InternalLink')?.getChild('InternalPath');
                if (pathNode) {
                    const path = state.doc.sliceString(pathNode.from, pathNode.to);
                    const linkInfo = linkMap.find(l => l.name === path || l.filePath === path);

                    if (linkInfo?.embedComponent) {
                        const line = state.doc.lineAt(node.from);
                        const props: Record<string, any> = { linkData: linkInfo };
                        if (linkInfo.filePath) {
							const displayNode = node.node.getChild('InternalLink')?.getChild('InternalDisplay')
                            props.filePath = linkInfo.filePath;
							if (displayNode?.from && displayNode?.to)
								props.display = state.doc.sliceString(displayNode.from, displayNode.to)
                        }

                        widgets.push(Decoration.widget({
                            widget: new ProseVueComponentEmbedWidget(
                                linkInfo.embedComponent, 
                                linkInfo?.componentProps ? { ...linkInfo?.componentProps, ...props } : props, 
                                node.from,
                                node.from,
                                node.to
                            ),
                            block: true,
                            side: 1
                        }).range(line.to));

                        const poses = toCursorNodePositions(state, node)
                        if (!(isNodeRangeActive(state, node.from, node.to) || cursorSelectionCoveredNode(poses.cursorFrom, poses.cursorTo, poses.nodeFrom, poses.nodeTo))) {
                            decorations.push(Decoration.replace({}).range(node.from, node.to));
                        }
                        return false;
                    }
                }
            }

            if (node.name === 'InternalLink' || node.name === 'Embed') {
                const mainNode = node.node;
                const isActive = isNodeRangeActive(state, mainNode.from, mainNode.to);
                if (isActive) return;

                const contentContainerNode = node.name === 'Embed' ? mainNode.getChild('InternalLink') : mainNode;
                if (!contentContainerNode) return;

                const pathNode = contentContainerNode.getChild('InternalPath');
                if (!pathNode) return;

                const path = state.doc.sliceString(pathNode.from, pathNode.to);
                const subpathNode = contentContainerNode.getChild('InternalSubpath');
                const aliasNode = contentContainerNode.getChild('InternalDisplay');
                const subpath = subpathNode ? state.doc.sliceString(subpathNode.from, subpathNode.to) : undefined;
                const alias = aliasNode ? state.doc.sliceString(aliasNode.from, aliasNode.to) : undefined;

                const linkInfo = linkMap.find(l => l.name === path || l.filePath === path);

                // Skip decoration if it's an embed that should be a widget
                if (node.name === 'Embed' && linkInfo?.embedComponent) {
                    return false;
                }

                const linkAttributes: { [key: string]: string } = {
                    'class': 'cm-link',
                    'href': '#',
                    'data-internal-link': 'true',
                    'data-path': path,
                    'data-type': node.name === 'Embed' ? 'embed' : 'internal-link'
                };

                if (!linkInfo) {
                    linkAttributes['class'] += ' cm-unresolved-link';
                } else {
                    linkAttributes['data-reference-id'] = linkInfo.referenceId;
                }

                if (subpath) linkAttributes['data-subpath'] = subpath;
                if (alias) linkAttributes['data-display'] = alias;

                if (node.name === 'Embed') {
                    const embedMark = mainNode.getChild('EmbedMark');
                    if (embedMark) {
                        decorations.push(Decoration.replace({}).range(embedMark.from, embedMark.to));
                    }
                }

                if (aliasNode) {
                    decorations.push(Decoration.mark({ tagName: 'a', attributes: linkAttributes }).range(aliasNode.from, aliasNode.to));
                    decorations.push(Decoration.replace({}).range(pathNode.from, pathNode.to));
                    if (subpathNode) {
                        decorations.push(Decoration.replace({}).range(subpathNode.from, subpathNode.to));
                    }
                } else {
                    const linkStart = pathNode.from;
                    const linkEnd = subpathNode ? subpathNode.to : pathNode.to;
                    decorations.push(Decoration.mark({ tagName: 'a', attributes: linkAttributes }).range(linkStart, linkEnd));
                }

                contentContainerNode.getChildren('InternalMark').forEach(mark => {
                    decorations.push(Decoration.replace({}).range(mark.from, mark.to));
                });

                return false;
            }
        }
    });

    return [...decorations, ...widgets];
}

export const proseInternalLinkCodemirrorViewPlugin = StateField.define<DecorationSet>({
    create(state) {
        return RangeSet.of(buildInternalLinkDecorations(state), true);
    },
    update(oldDecorations, tr) {
        // If document changed, we must rebuild affected ranges
        if (tr.docChanged) {
            // For doc changes, rebuild everything for now
            // Could be optimized further to only rebuild changed ranges
            return RangeSet.of(buildInternalLinkDecorations(tr.state), true);
        }
        
        // If only selection changed, check if cursor entered/left any embeds/links
        if (tr.selection) {
            const oldCursor = tr.startState.selection.main
            const newCursor = tr.state.selection.main
            
            // Get all Embed and InternalLink ranges from syntax tree
            const linkRanges = getEmbedAndInternalLinkRanges(tr.state)
            
            // Check if cursor state changed (entered or left a link/embed)
            const wasInLink = isCursorInAnyRange(oldCursor, linkRanges)
            const isInLink = isCursorInAnyRange(newCursor, linkRanges)
            
            // Rebuild if cursor entered or left any link/embed
            // Widgets with eq() returning true won't remount
            if (wasInLink !== isInLink) {
                return RangeSet.of(buildInternalLinkDecorations(tr.state), true);
            }
            
            // Cursor moved but didn't cross link/embed boundaries
            return oldDecorations;
        }
        
        // No changes that affect decorations
        return oldDecorations.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f)
});
