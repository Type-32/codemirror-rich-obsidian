import { describe, expect, it } from 'vitest'
import { EditorState, type StateField } from '@codemirror/state'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Decoration, type DecorationSet } from '@codemirror/view'
import { createProsePlugin } from '../src/runtime/editor/plugins/codemirror-plugin-proses/createProsePlugin'
import { lang } from './helpers'

const marked = Decoration.mark({ class: 'x' })
const blocks = createProsePlugin({
	block: true,
	nodes: ['FencedCode'],
	decorate: (node, _state, _active, out) => { out.push(marked.range(node.from, node.to)) },
}) as StateField<DecorationSet>

const count = (s: EditorState) => s.field(blocks).size

describe('createProsePlugin (block)', () => {
	it('decorates nodes the parser reaches after the doc was loaded', () => {
		// Past the few thousand characters a new state parses up front, so the block isn't in the tree yet.
		const filler = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} of filler text.`).join('\n\n')
		const start = EditorState.create({ doc: `${filler}\n\n\`\`\`base\nviews: []\n\`\`\`\n`, extensions: [lang, blocks] })
		expect(syntaxTree(start).length).toBeLessThan(start.doc.length)
		expect(count(start)).toBe(0)

		// The view's parse worker carries on in the background and hands over the tree without changing the doc.
		ensureSyntaxTree(start, start.doc.length, 5000)
		expect(count(start.update({}).state)).toBe(1)
	})
})
