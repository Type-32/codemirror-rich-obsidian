import { load } from 'js-yaml'
import { parseMarkdownToAST } from './markdownParser'
import type { Frontmatter } from '../editor/types/editor-types';

export function parseFrontmatter(markdownText: string): { data?: Frontmatter; error?: Error } {
    if (!markdownText) {
        return { error: new Error('No markdown text provided') }
    }

    const tree = parseMarkdownToAST(markdownText)

    const firstNode = tree.topNode.firstChild
    if (!firstNode || firstNode.name !== 'YAMLFrontMatter') {
        return { data: {} }
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
