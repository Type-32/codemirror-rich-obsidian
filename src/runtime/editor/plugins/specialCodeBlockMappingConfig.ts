import { Facet } from '@codemirror/state'
import type { SpecialCodeBlockMapping } from '#codemirror-rich-obsidian-editor/editor-types'

export const specialCodeBlockMapFacet = Facet.define<SpecialCodeBlockMapping[], SpecialCodeBlockMapping[]>({
    combine: (values) => values.flat(),
})
