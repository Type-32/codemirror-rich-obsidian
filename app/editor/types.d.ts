import type { Component } from 'vue'

export interface InternalLink {
    internalLinkName: string;
    filePath?: string;
    redirectToPath: string;
    embedComponent?: Component;
}

export interface SpecialCodeBlockMapping {
    codeInfo: string
    component: Component
}