import { describe, expect, it } from 'vitest'
import { EditorSelection, EditorState, type StateField } from '@codemirror/state'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Decoration, type DecorationSet } from '@codemirror/view'
import { createProsePlugin } from '../src/runtime/editor/plugins/codemirror-plugin-proses/createProsePlugin'
import { proseInternalLinkPlugin } from '../src/runtime/editor/plugins/codemirror-plugin-proses/proseInternalLinkCodemirrorViewPlugin'
import { ProseVueComponentEmbedWidget } from '../src/runtime/editor/plugins/codemirror-widgets/proseVueComponentEmbedWidget'
import { internalLinkMapFacet } from '../src/runtime/editor/plugins/linkMappingConfig'
import { lang, parsed } from './helpers'

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

describe('proseInternalLinkPlugin', () => {
	const links = internalLinkMapFacet.of([{ name: 'P.base', referenceId: 'p', embedComponent: {} }])
	const field = proseInternalLinkPlugin as StateField<DecorationSet>
	/** Embed widgets this editor draws, with the cursor at `cursor` (default: the start, outside everything). */
	const embeds = (doc: string, cursor = 0) => {
		const s = parsed(EditorState.create({ doc, extensions: [lang, links, field], selection: EditorSelection.cursor(cursor) }))
		let n = 0
		s.update({}).state.field(field).between(0, s.doc.length, (_f, _t, d) => { if (d.spec.widget instanceof ProseVueComponentEmbedWidget) n++ })
		return n
	}

	it('draws an embed itself, but not inside a rendered callout or table, whose nested editors draw it', () => {
		expect(embeds('x\n\n![[P.base]]\n')).toBe(1)
		const callout = 'x\n\n> [!note] T\n> ![[P.base]]\n'
		expect(embeds(callout)).toBe(0)
		// A callout the cursor is in shows as source, so its embed is this editor's again.
		expect(embeds(callout, callout.indexOf('![['))).toBe(1)
		expect(embeds('x\n\n| A |\n| --- |\n| ![[P.base]] |\n')).toBe(0)
	})
})
