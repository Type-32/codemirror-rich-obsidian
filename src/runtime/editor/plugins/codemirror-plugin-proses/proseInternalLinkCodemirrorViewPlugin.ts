import { Decoration } from '@codemirror/view'
import { internalLinkMapFacet } from '../linkMappingConfig'
import { ProseVueComponentEmbedWidget } from '../codemirror-widgets/proseVueComponentEmbedWidget'
import { createProsePlugin } from './createProsePlugin'

const hidden = Decoration.replace({})

/**
 * `[[path#sub|alias]]` → <a>; `![[path]]` with a registered `embedComponent` → block widget
 * under the line (source hidden unless touched). Unregistered embeds render as links.
 */
export const proseInternalLinkPlugin = createProsePlugin({
    block: true,
    nodes: ['InternalLink', 'Embed'],
    reconfigureOn: [internalLinkMapFacet],
    decorate(node, state, active, out) {
        const isEmbed = node.name === 'Embed'
        const main = node.node
        const link = isEmbed ? main.getChild('InternalLink') : main
        const pathNode = link?.getChild('InternalPath')
        if (!link || !pathNode) return false
        const path = state.doc.sliceString(pathNode.from, pathNode.to)
        const linkInfo = state.facet(internalLinkMapFacet).find(l => l.name === path || l.filePath === path)
        const displayNode = link.getChild('InternalDisplay')
        const subpathNode = link.getChild('InternalSubpath')

        if (isEmbed && linkInfo?.embedComponent) {
            const props: Record<string, unknown> = { linkData: linkInfo, ...linkInfo.componentProps }
            if (linkInfo.filePath) props.filePath = linkInfo.filePath
            if (displayNode) props.display = state.doc.sliceString(displayNode.from, displayNode.to)
            out.push(Decoration.widget({
                widget: new ProseVueComponentEmbedWidget(linkInfo.embedComponent, props, node.from, node.to),
                block: true,
                side: 1,
            }).range(state.doc.lineAt(node.from).to))
            if (!active) out.push(hidden.range(node.from, node.to))
            return false
        }

        if (active) return false

        const attrs: Record<string, string> = {
            class: linkInfo ? 'cm-link' : 'cm-link cm-unresolved-link',
            href: '#',
            'data-internal-link': 'true',
            'data-path': path,
            'data-type': isEmbed ? 'embed' : 'internal-link',
        }
        if (linkInfo) attrs['data-reference-id'] = linkInfo.referenceId
        if (subpathNode) attrs['data-subpath'] = state.doc.sliceString(subpathNode.from, subpathNode.to)
        if (displayNode) attrs['data-display'] = state.doc.sliceString(displayNode.from, displayNode.to)
        const anchor = Decoration.mark({ tagName: 'a', attributes: attrs })

        const embedMark = isEmbed ? main.getChild('EmbedMark') : null
        if (embedMark) out.push(hidden.range(embedMark.from, embedMark.to))
        if (displayNode) {
            out.push(hidden.range(pathNode.from, subpathNode ? subpathNode.to : pathNode.to))
            out.push(anchor.range(displayNode.from, displayNode.to))
        } else {
            out.push(anchor.range(pathNode.from, subpathNode ? subpathNode.to : pathNode.to))
        }
        for (const m of link.getChildren('InternalMark')) out.push(hidden.range(m.from, m.to))
        return false
    },
})
