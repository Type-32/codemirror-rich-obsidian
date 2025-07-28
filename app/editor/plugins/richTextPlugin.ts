import type {DecorationSet, EditorView, ViewUpdate} from '@codemirror/view'
import {Decoration, type PluginValue} from '@codemirror/view';
import {syntaxTree} from '@codemirror/language';
import type {Range} from '@codemirror/state';
import {cursorInNode} from "~/editor/utility/tools";
import {
    decorationBullet,
    decorationCode,
    decorationHidden,
    decorationProseHashtag,
    decorationTag
} from "~/editor/utility/decorations";

const revealComponentMarkTokensOnCursor = [
    'InlineCode',
    'Emphasis',
    'StrongEmphasis',
    'FencedCode',
    'Strikethrough',
    'Link',
]; // The Mark Tokens to reveal when the cursor is over the node.

const hideComponentMarkTokens = [
    'HardBreak',
    'LinkMark',
    'EmphasisMark',
    'CodeMark',
    'CodeInfo',
    'StrikethroughMark',
    'URL',
];

/* DOCUMENTATION TO SELF:
* The syntaxTree.iterate function iterates through all the nodes the editor has parsed. For my future understanding,
* there's two types of nodes: one is a Mark Node and the other is a Component Node.
* For example: parsing "**hello**" would give you in the following AST sequence,
* 1. Strong Emphasis "**hello**"
* 2. Emphasis Mark "**" (the first two)
* 3. Emphasis Mark "**" (the last two)
*
* The StrongEmphasis in this part is what I'm comprehending as a Component Node, and the Emphasis Marks are the Mark Nodes.
* This AST is parsed token by token (depending on your parser, that is). But, it's also important to note that the sequence
* of how the nodes are added to the AST is also based on the parser. (Internal links, such as "[[internallink]]", parses as:
* 1. Internal Mark "[["
* 2. Internal Path "internallink"
* 3. Internal Mark "]]"
*
* ...which is different than the GFM lezer parser. The OFM lezer parser adds the sequences differently.
* )
*
* The `revealComponentMarkTokensOnCursor` must be used with the `hideComponentMarkTokens`. So, the part in footnote [^1]
* in the following code basically detects that: if the selection cursor is inbetween or have overlapped the Component Node,
* don't add decorations to that part of the node. The part in the footnote [^2] in the following code, after determining
* that the cursor selection IS NOT overlapping the currently iterated node (since it's running after part [^1]), adds the decoration to the iterated node.
*
* Then in the final processing results, it returns what Nodes shall be decorated and what shall not be decorated.
* If you want a more thorough documentation of Decorations, read the official docs: https://codemirror.net/examples/decoration/
*
* All being said, there's one thing that must not be mistaken: Decorations are not Style Highlights. segphault's implementation
* included using both the Decorations API from CodeMirror to hide Mark Nodes and render Component Nodes, and @lezer/highlight tags
* to render some of the persistent prose styles. To put it in simple terms: when editing an emphasis part like this "**emphasis**",
* the Decorations are removed for that node, but its emphasis-css-style is still applied, and the Mark Node css styles are applied as well.
* That styling is done using @lezer/highlight tags.
*
* @lezer/highlight tags are defined symbols that is the equivalent of a separate ID for a Node. It's like... tagging specific Nodes with their corresponding trackers,
* which the trackers can be utilized by developers to later "track down" the node and "apply" a CSS-styling to the Node. More or so like that.
* In even shorter terms, its system that tags the keywords you see in IDEs and colors them, except the editor is in javascript.
* */

export default class RichEditPlugin implements PluginValue {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.process(view);
    }

    update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged || update.selectionSet)
            this.decorations = this.process(update.view);
    }

    process(view: EditorView): DecorationSet {
        let widgets: Range<Decoration>[] = [];
        let [cursor] = view.state.selection.ranges;

        for (let {from, to} of view.visibleRanges) {
            syntaxTree(view.state).iterate({
                from, to,
                enter(node) {
                    const nodeName = node.name;
                    const nodeFrom = node.from;
                    const nodeTo = node.to;

                    if (nodeName === 'FencedCode')
                        widgets.push(decorationCode.range(nodeFrom, nodeTo));

                    // [^1]: the part to determine whether the current iterated node should be added a decoration.
                    if ((nodeName.startsWith('ATXHeading') || revealComponentMarkTokensOnCursor.includes(nodeName)) && cursorInNode(cursor?.from, cursor?.to, nodeFrom, nodeTo))
                        return false; // Returning false reveals the marks in the current line.

                    if (nodeName === 'ListMark' && node.matchContext(['BulletList', 'ListItem']) && cursor?.from != nodeFrom && cursor?.from != nodeFrom + 1)
                        widgets.push(decorationBullet.range(nodeFrom, nodeTo));

                    // [^2] determines whether the currently iterated node should be added a decoration that hides the current node.
                    if (hideComponentMarkTokens.includes(node.name))
                        widgets.push(decorationHidden.range(nodeFrom, nodeTo));

                    // [^3] Basically the same as below, but processed individually because it hides the header separately.
                    if (nodeName === 'HeaderMark')
                        widgets.push(decorationHidden.range(nodeFrom, nodeTo + 1));
                }
            });
        }

        return Decoration.set(widgets, true);
    }
}

