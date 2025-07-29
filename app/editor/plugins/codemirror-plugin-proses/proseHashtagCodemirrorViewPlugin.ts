import {Decoration, type DecorationSet, EditorView} from '@codemirror/view';
import { StateField, RangeSet } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range as EditorRange } from '@codemirror/state';
import {decorationProseHashtag} from "~/editor/utility/decorations";

/* DOCUMENTATION TO SELF:
* Hello there. You're wondering: "What the fuck is this plugin? Why are plugins everyfuckingwhere?"
* To that I'll tell you calm the fuck down. I'll explain.
*
* There's 2 types of plugins here:
* - The CodeMirror Plugins
* - The Lezer-Parser "Plugin"
*
* This, right here, is a CodeMirror State Field Plugin for adding decorations to Hashtag Nodes that styles inline markdown tags.
* The richTextPlugin on the other hand is a View Plugin that basically packs up all of the CodeMirror plugins into one big rich-text-edit plugin.
* */

function buildHashtagWrappers(state: EditorState): EditorRange<Decoration>[] {
    const decorations: EditorRange<Decoration>[] = [];
    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'HashtagTag') {
                decorations.push(decorationProseHashtag.range(node.from, node.to));
            }
        }
    });
    return decorations;
}

export const proseHashtagCodemirrorViewPlugin = StateField.define<DecorationSet>({
    create(state) {
        return RangeSet.of(buildHashtagWrappers(state));
    },
    update(value, tr) {
        if (tr.docChanged) { // Or also on selection if visibility changes
            return RangeSet.of(buildHashtagWrappers(tr.state));
        }
        return value.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f)
});