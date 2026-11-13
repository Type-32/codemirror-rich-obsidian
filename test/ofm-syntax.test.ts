import { describe, expect, it } from 'vitest'
import { EditorState, type StateField } from '@codemirror/state'
import { LanguageDescription, ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import type { DecorationSet } from '@codemirror/view'
import { highlightTree } from '@lezer/highlight'
import { proseCalloutPlugin } from '../src/runtime/editor/plugins/codemirror-plugin-proses/proseCalloutPlugin'
import { codeBlockLabel, proseCodeBlockPlugin } from '../src/runtime/editor/plugins/codemirror-plugin-proses/proseCodeBlockCodemirrorViewPlugin'
import { codeHighlighter } from '../src/runtime/editor/plugins/codeHighlighter'
import proseStyles from '../src/runtime/editor/plugins/lezerStylesHighlightingPlugin'
import { markdownConfig } from '../src/runtime/editor/wysiwyg'
import { state } from './helpers'

// Expectations below are what Obsidian 1.12 does with the same source.

const isTask = (src: string) => {
    let task = false
    syntaxTree(state(src)).iterate({ enter: n => { if (n.name === 'Task') task = true } })
    return task
}

describe('tasks', () => {
    it('any single status character, followed by a space or tab', () => {
        for (const src of ['- [ ] a', '- [x] a', '- [/] a', '- [-] a', '- [>] a', '- [?] a', '- []] a', '- [x]\ta', '1. [ ] a', '* [ ] a', '+ [ ] a'])
            expect(isTask(src), src).toBe(true)
    })
    it('not a task without the space, with an empty or long marker, or with nothing after it', () => {
        for (const src of ['- [ ]x', '- [] a', '- [ab] a', '- [ ]', '- [x]'])
            expect(isTask(src), src).toBe(false)
    })
})

describe('callouts', () => {
    const field = proseCalloutPlugin as StateField<DecorationSet>
    // The cursor sits on a leading paragraph so the callout is rendered, not revealed.
    const rendered = (src: string) => state(`x\n\n${src}`, field).field(field).size > 0

    it('renders Obsidian callouts', () => {
        for (const src of ['> [!note]\n> body', '> [!NOTE] Title', '>[!note] No space', '> [!faq]- Folded', '> [!todo]+ Open',
            '> [!custom-thing] Unknown', '> [!note|wide] Metadata', '> [!note] T\nlazy line', '> [!note] T\n>\n> body'])
            expect(rendered(src), src).toBe(true)
    })
    it('requires the marker at the start of the first line, followed by a space or line end', () => {
        for (const src of ['> [!note]Title glued', '> [ !note] spaced', '> hello [!note] mid line', '> intro\n> [!note] second line', 'plain [!note] paragraph'])
            expect(rendered(src), src).toBe(false)
    })
})

describe('code blocks', () => {
    async function classes(src: string) {
        await LanguageDescription.matchLanguageName(languages, 'js', true)!.load()
        // @ts-ignore lezer extension typing is looser than lang-markdown's
        const s = EditorState.create({ doc: src, extensions: markdown({ ...markdownConfig(), codeLanguages: languages }) })
        ensureSyntaxTree(s, s.doc.length, 5000)
        const out: Record<string, string> = {}
        for (const highlighter of [codeHighlighter, proseStyles]) {
            highlightTree(syntaxTree(s), highlighter, (from, to, cls) => {
                const text = s.sliceDoc(from, to)
                out[text] = out[text] ? `${out[text]} ${cls}` : cls
            })
        }
        return out
    }

    it('fenced code gets language tokens, not the inline-code style', async () => {
        const c = await classes('```js\nconst a = "s" // c\n```\n\n`inline`')
        expect(c.const).toContain('cm-code-keyword')
        expect(c['"s"']).toContain('cm-code-string')
        expect(c['// c']).toContain('cm-code-comment')
        expect(Object.entries(c).filter(([, v]) => v.includes('cm-mono')).map(([k]) => k)).toEqual(['inline'])
    })

    // Source lines the rendered block hides (the fences).
    const hidden = (src: string) => {
        const field = proseCodeBlockPlugin as StateField<DecorationSet>
        const s = state(src, field)
        const lines: string[] = []
        s.field(field).between(0, s.doc.length, (from, to, deco) => { if (deco.spec.widget) lines.push(s.sliceDoc(from, to)) })
        return lines
    }

    it('hides both fences while the cursor is outside; anywhere inside reveals both', () => {
        expect(hidden('x«»\n\n```js\na\nb\n```')).toEqual(['```js', '```'])
        expect(hidden('x\n\n```js\n«»a\nb\n```')).toEqual([])
        expect(hidden('x\n\n```js\na\nb\n``«»`')).toEqual([])
    })

    it('leaves an unclosed fence as source', () => {
        expect(hidden('x«»\n\n```js\nunclosed\nlast line')).toEqual([])
    })

    it('labels the block with the language name, the raw tag if unknown, nothing without one', () => {
        expect(['js', 'ts', 'python', 'css', 'js title="x.js"', 'unknownlang', ''].map(codeBlockLabel))
            .toEqual(['JavaScript', 'TypeScript', 'Python', 'CSS', 'JavaScript', 'unknownlang', ''])
    })
})
