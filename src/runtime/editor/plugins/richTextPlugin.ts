import { Decoration } from '@codemirror/view'
import { decorationHidden } from '../utility/decorations'
import { createProsePlugin } from './codemirror-plugin-proses/createProsePlugin'

/*
 * Generic mark hiding: `**bold**` → bold, `~~x~~` → strikethrough, `# H` → heading, `---` → <hr>.
 * A container node whose marks we hide is "revealed" (marks shown) while the selection touches it.
 *
 * Nodes with their own plugin (FencedCode, Link, Image, InternalLink, Embed, Mark/==highlight==)
 * are NOT listed here: one owner per node type, otherwise two plugins race to replace the same range.
 */

// Container → its mark children. Reveal the whole container on touch.
const CONTAINERS: Record<string, true> = {
	Emphasis: true,
	StrongEmphasis: true,
	Strikethrough: true,
	InlineCode: true,
	Comment: true,
	Footnote: true,
	FootnoteReference: true,
	ATXHeading1: true, ATXHeading2: true, ATXHeading3: true,
	ATXHeading4: true, ATXHeading5: true, ATXHeading6: true,
}

const MARKS: Record<string, true> = {
	EmphasisMark: true,
	CodeMark: true,
	StrikethroughMark: true,
	FootnoteMark: true,
	CommentMarker: true,
}

const hrLine = Decoration.line({ attributes: { class: 'hr' } })

export const richTextPlugin = createProsePlugin({
	nodes: [...Object.keys(CONTAINERS), 'HorizontalRule'],
	decorate(node, state, active, out) {
		if (active) return false // revealed: leave marks visible, skip children
		if (node.name === 'HorizontalRule') {
			out.push(decorationHidden.range(node.from, node.to))
			out.push(hrLine.range(state.doc.lineAt(node.from).from))
			return false
		}
		for (let c = node.node.firstChild; c; c = c.nextSibling) {
			if (c.name === 'HeaderMark') out.push(decorationHidden.range(c.from, Math.min(c.to + 1, node.to))) // eat the trailing space
			else if (MARKS[c.name]) out.push(decorationHidden.range(c.from, c.to))
		}
	},
})
