import { load } from 'js-yaml'
import { markdown } from '@codemirror/lang-markdown'
import { GFM, type MarkdownExtension } from '@lezer/markdown'
import { CustomOFM } from '../editor/lezer-parsers/customOFMParsers'
import type { Frontmatter } from '../editor/types/editor-types';

export function parseFrontmatter(markdownText: string): { data?: Frontmatter; error?: Error } {
    if (!markdownText) {
        return {}
    }

    const tree = markdown({
        extensions: [GFM, CustomOFM as MarkdownExtension[], { remove: ['SetextHeading'] }],
    }).language.parser.parse(markdownText)

    const firstNode = tree.topNode.firstChild
    if (!firstNode || firstNode.name !== 'YAMLFrontMatter') {
        return {}
    }

    const contentNode = firstNode.getChild('YAMLContent')
    const yamlContent = contentNode ? markdownText.slice(contentNode.from, contentNode.to) : ''

    try {
        const data = load(yamlContent)

        if (data === null || data === undefined) {
            return { data: {} }
        }

        if (typeof data === 'object') {
            return { data: data as Frontmatter }
        }

        return { error: new Error('Frontmatter is not a valid object.') }
    } catch (e: any) {
        return { error: e }
    }
}
