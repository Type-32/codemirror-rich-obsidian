import { Facet } from '@codemirror/state';
import type { Component } from 'vue';

export interface InternalLink {
    internalLinkName: string;
    filePath?: string;
    redirectToPath: string;
    embedComponent?: Component;
}

export const internalLinkMapFacet = Facet.define<InternalLink[], InternalLink[]>({
    combine: values => values.length ? values.flat() : [],
});