import { describe, expect, it } from 'vitest'
import { EditorSelection, EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import katex from 'katex'
import wysiwyg from '../src/runtime/editor/wysiwyg'
import { katexOptions } from '../src/runtime/editor/plugins/codemirror-widgets/proseLatexWidgets'
import { renderers } from './helpers'

// Seeded, so a failure reproduces: a random walk over notes made of the syntax that renders as widgets.
let seed = 11
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const int = (n: number) => Math.floor(rnd() * n)
const TOKENS = ['[[a]]', '![[b]]', '[x](http://x)', '[](http://x)', 'http://x.y/p.png', '#a', '==', '%%', '$', '$$', '\n', '\n\n', '> ', '> [!note] ', '- ', '1. ', '[ ] ', '```', '```ts\n', '---', '\n---\nk: v\n---\n', '\n| a | b |\n| - | - |\n| c | d |', ' ', 'a', '**', '|']
const fuzz = (n: number) => Array.from({ length: n }, () => TOKENS[int(TOKENS.length)]).join('')
const ext = [wysiwyg(), renderers]

/** Every decoration state fields provide, as `from-to` plus the decoration, field by field. */
const decorations = (s: EditorState) => s.facet(EditorView.decorations).filter((d): d is DecorationSet => typeof d !== 'function').map((set) => {
    const out: [number, number, Decoration][] = []
    for (const it = set.iter(); it.value; it.next()) out.push([it.from, it.to, it.value])
    return out
})

describe('block decorations', () => {
    it('updated in place after edits and caret moves, equal a fresh render', () => {
        for (let round = 0; round < 300; round++) {
            let s = EditorState.create({ doc: fuzz(1 + int(60)), extensions: ext })
            for (let step = 0; step < 6; step++) {
                const from = int(s.doc.length + 1), to = Math.min(s.doc.length, from + int(5))
                s = rnd() < 0.5
                    ? s.update({ changes: { from, to, insert: fuzz(int(3)) }, selection: EditorSelection.cursor(from), userEvent: 'input.type' }).state
                    : s.update({ selection: EditorSelection.single(from, to) }).state
                const fresh = EditorState.create({ doc: s.doc, selection: s.selection, extensions: ext })
                // A reparse can differ from a fresh parse (a leading line deleted above frontmatter): lezer's, not ours.
                if (syntaxTree(s).toString() !== syntaxTree(fresh).toString()) continue
                const [a, b] = [decorations(s), decorations(fresh)]
                a.forEach((set, i) => {
                    const same = set.length === b[i]!.length && set.every(([f, t, d], j) => f === b[i]![j]![0] && t === b[i]![j]![1] && d.eq(b[i]![j]![2]))
                    expect(same, JSON.stringify({ round, step, doc: s.doc.toString(), field: i })).toBe(true)
                })
            }
        }
    })
})

describe('math', () => {
    it('cannot define macros, so a few lines cannot expand to millions of glyphs', () => {
        const levels = '\\def\\b{\\a\\a\\a\\a\\a\\a\\a\\a\\a\\a}\\def\\c{\\b\\b\\b\\b\\b\\b\\b\\b\\b\\b}\\c'
        const html = katex.renderToString(`\\def\\a{${'x'.repeat(1000)}}${levels}`, katexOptions(true))
        expect(html.length).toBeLessThan(200_000)
        expect(html).toContain('\\def')
        expect(katex.renderToString('\\frac{a}{b} \\neq \\dots', katexOptions(false))).not.toContain('#cc0000')
    })
})
