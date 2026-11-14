import { Facet, type EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { PropertiesOptions } from '../types/editor-types'

/** Options of the properties panel; the first value wins. */
export const propertiesOptions = Facet.define<PropertiesOptions, PropertiesOptions>({ combine: values => values[0] ?? {} })

/** End of the frontmatter block opening the document, or null when there is none. */
export function frontmatterEnd(state: EditorState): number | null {
    const node = syntaxTree(state).topNode.firstChild
    return node?.name === 'YAMLFrontMatter' && node.from === 0 ? node.to : null
}
