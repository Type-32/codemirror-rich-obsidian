import { Facet } from '@codemirror/state'
import type { Component } from 'vue'

export interface SpecialCodeBlockMapping {
    codeInfo: string
    component: Component
}

export const specialCodeBlockMapFacet = Facet.define<SpecialCodeBlockMapping[], SpecialCodeBlockMapping[]>({
    combine: (values) => values.flat(),
})
