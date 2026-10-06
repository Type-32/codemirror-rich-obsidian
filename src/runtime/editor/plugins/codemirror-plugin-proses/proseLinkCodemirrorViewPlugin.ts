import { Decoration } from '@codemirror/view'
import { ProseVueComponentEmbedWidget } from '../codemirror-widgets/proseVueComponentEmbedWidget'
import ImageEmbedComponent from '../../../components/Editor/ImageEmbedComponent.vue'
import { createProsePlugin } from './createProsePlugin'

const hidden = Decoration.replace({})
const IMAGE_URL = /\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i

/**
 * `[text](url)` → <a>text</a>; `![alt](src)` → image embed; bare URLs → <a>. Image/Link nodes
 * emit block widgets, so this is a StateField.
 */
export const proseLinkPlugin = createProsePlugin({
    block: true,
    nodes: ['Image', 'Link', 'URL'],
    decorate(node, state, active, out) {
        const n = node.node
        if (node.name === 'Image') {
            if (active) return false
            const url = n.getChild('URL')
            const open = n.getChildren('LinkMark')[0]
            if (!url) return false
            const alt = open ? state.doc.sliceString(open.to, Math.max(open.to, url.from - 2)) : undefined
            out.push(Decoration.replace({
                widget: new ProseVueComponentEmbedWidget(ImageEmbedComponent, { filePath: state.doc.sliceString(url.from, url.to), display: alt }, node.from, node.to),
                block: true,
            }).range(node.from, node.to))
            return false
        }

        if (node.name === 'Link') {
            if (active) return false
            const url = n.getChild('URL')
            const marks = n.getChildren('LinkMark')
            const open = marks.find(m => state.doc.sliceString(m.from, m.to) === '[')
            const close = marks.find(m => state.doc.sliceString(m.from, m.to) === ']')
            if (!url || !open || !close) return false
            const href = state.doc.sliceString(url.from, url.to)
            out.push(hidden.range(node.from, open.to))
            out.push(Decoration.mark({
                tagName: 'a',
                attributes: {
                    href, target: '_blank', class: 'cm-clickable-link', 'data-external-link': 'true', 'data-url': href,
                    'data-text': state.doc.sliceString(open.to, close.from),
                },
            }).range(open.to, close.from))
            out.push(hidden.range(close.from, node.to))
            return false
        }

        // Bare URL (autolink). Parent Link/Image already returned false, so this is only reached standalone.
        const href = state.doc.sliceString(node.from, node.to)
        if (IMAGE_URL.test(href)) {
            out.push(Decoration.widget({
                widget: new ProseVueComponentEmbedWidget(ImageEmbedComponent, { filePath: href }, node.from, node.to),
                block: true,
                side: 1,
            }).range(state.doc.lineAt(node.from).to))
        }
        if (!active) {
            out.push(Decoration.mark({
                tagName: 'a',
                attributes: { href, target: '_blank', class: 'cm-clickable-link', 'data-external-link': 'true', 'data-url': href },
            }).range(node.from, node.to))
        }
    },
})
