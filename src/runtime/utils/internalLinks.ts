import type { SyntaxNode } from '@lezer/common'
import { parseMarkdownToAST } from './markdownParser'
import type { InternalLinkNode } from '../editor/types/editor-types'

export function getInternalLinks(markdownText: string): InternalLinkNode[] {
    const links: InternalLinkNode[] = []
    const tree = parseMarkdownToAST(markdownText)

    tree.iterate({
        enter: (node) => {
            if (node.name === 'InternalLink') {
                const link: InternalLinkNode = { path: '' }

                const pathNode = node.node.getChild('InternalPath')
                if (pathNode) {
                    link.path = markdownText.slice(pathNode.from, pathNode.to)
                }

                const subpathNode = node.node.getChild('InternalSubpath')
                if (subpathNode) {
                    link.subpath = markdownText.slice(subpathNode.from, subpathNode.to)
                }

                const displayNode = node.node.getChild('InternalDisplay')
                if (displayNode) {
                    link.display = markdownText.slice(displayNode.from, displayNode.to)
                }
                
                if(link.path) {
                    links.push(link)
                }
            }
        },
    })

    return links
}
