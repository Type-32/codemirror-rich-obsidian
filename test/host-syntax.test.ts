import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import type { MarkdownConfig } from '@lezer/markdown'
import type { Tree } from '@lezer/common'
import wysiwyg from '../src/runtime/editor/wysiwyg'
import { nestedEditorContent } from '../src/runtime/editor/utility/nestedEditor'
import { parseMarkdownToAST } from '../src/runtime/utils/markdownParser'

/** `{{name}}`: a template variable, standing in for a host's own syntax. */
const variable: MarkdownConfig = {
    defineNodes: [{ name: 'Variable' }],
    parseInline: [{
        name: 'Variable',
        parse(cx, next, pos) {
            if (next !== 123 || cx.char(pos + 1) !== 123) return -1
            const end = cx.slice(pos, cx.end).indexOf('}}')
            return end > 2 ? cx.addElement(cx.elt('Variable', pos, pos + end + 2)) : -1
        },
    }],
}
const options = { extensions: [variable] }
const doc = 'Hello {{name}}, and **{{bold}}**.\n\n> [!note] Title\n> body {{inside}}\n'

const variables = (tree: Tree) => {
    const out: string[] = []
    tree.iterate({ enter: n => void (n.name === 'Variable' && out.push(doc.slice(n.from, n.to))) })
    return out
}

describe('host Markdown syntax', () => {
    it('is parsed by the live preview, and by the nested editors it creates (callouts, table cells)', () => {
        const state = EditorState.create({ doc, extensions: wysiwyg({ lezer: options }) })
        expect(variables(ensureSyntaxTree(state, doc.length, 5000)!)).toEqual(['{{name}}', '{{bold}}', '{{inside}}'])
        // Nested editors are built from the content the editor provides, so they parse it too.
        const nested = EditorState.create({ doc, extensions: state.facet(nestedEditorContent)!() })
        expect(variables(ensureSyntaxTree(nested, doc.length, 5000)!)).toHaveLength(3)
    })

    it('is parsed offline with the same options, and not without them', () => {
        expect(variables(parseMarkdownToAST(doc, options))).toHaveLength(3)
        expect(variables(parseMarkdownToAST(doc))).toEqual([])
    })
})
