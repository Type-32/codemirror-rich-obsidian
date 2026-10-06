import { decorationProseHashtag } from '../../utility/decorations'
import { createProsePlugin } from './createProsePlugin'

/** Wraps `#tag` in an inline span; lezer-highlight tags can't style inline here. */
export const proseHashtagPlugin = createProsePlugin({
	nodes: ['HashtagTag'],
	decorate(node, _state, _active, out) {
		out.push(decorationProseHashtag.range(node.from, node.to))
	},
})
