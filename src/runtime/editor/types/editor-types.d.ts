import type { Component } from 'vue'

export interface InternalLink {
    internalLinkName: string;
    filePath?: string;
    redirectToPath: string;
    embedComponent?: Component;
}

export interface InternalLinkClickDetail {
    path: string;
    subpath?: string;
    display?: string;
    type: 'embed' | 'internal-link';
    redirectToPath?: string;
}

export interface ExternalLinkClickDetail {
    url: string;
    text: string | null;
}

export interface SpecialCodeBlockMapping {
    codeInfo: string
    component: Component
}

export type WysiwygPlugin = {
  lezer?: any
}
