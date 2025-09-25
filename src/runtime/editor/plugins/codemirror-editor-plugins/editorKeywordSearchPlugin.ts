import { Decoration, EditorView } from '@codemirror/view'
import { StateField, RangeSet, Facet } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import type { Range, EditorState, Text } from '@codemirror/state'
import type { SearchOptions } from '../../types/editor-types'

export const searchOptionsFacet = Facet.define<SearchOptions, SearchOptions>({
    combine: values => values[0] || { query: '', caseSensitive: false }
});

const highlightMark = Decoration.mark({ class: 'cm-highlight-keyword' });

function findKeywords(doc: Text, { query, caseSensitive }: SearchOptions): Range<Decoration>[] {
    const decorations: Range<Decoration>[] = [];
    if (!query) return decorations;

    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(query, flags);

    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        for (const match of line.text.matchAll(regex)) {
            if (match.index !== undefined) {
                const from = line.from + match.index;
                const to = from + match[0].length;
                decorations.push(highlightMark.range(from, to));
            }
        }
    }

    return decorations;
}

export const editorKeywordSearchPlugin = StateField.define<DecorationSet>({
    create(state: EditorState) {
        const options = state.facet(searchOptionsFacet);
        return RangeSet.of(findKeywords(state.doc, options));
    },
    update(value, tr) {
        const options = tr.state.facet(searchOptionsFacet);
        const oldOptions = tr.startState.facet(searchOptionsFacet);

        if (tr.docChanged || options.query !== oldOptions.query || options.caseSensitive !== oldOptions.caseSensitive) {
            return RangeSet.of(findKeywords(tr.state.doc, options));
        }
        return value.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f)
});
