import { Decoration } from '@codemirror/view'
import { createProsePlugin } from './createProsePlugin'

const highlighted = Decoration.mark({ class: 'cm-highlighted', tagName: 'span' })
const hidden = Decoration.replace({})

/** `==text==` → <span class="cm-highlighted">text</span>; markers hidden unless touched. */
export const proseHighlightPlugin = createProsePlugin({
	nodes: ['Mark'],
	decorate(node, state, active, out) {
		if (active) return
		const markers = node.node.getChildren('MarkMarker')
		const open = markers[0], close = markers[markers.length - 1]
		if (!open || !close || open === close) return
		if (state.doc.sliceString(open.from, open.to) !== '==' || state.doc.sliceString(close.from, close.to) !== '==') return
		out.push(hidden.range(open.from, open.to))
		out.push(highlighted.range(open.to, close.from))
		out.push(hidden.range(close.from, close.to))
	},
})
