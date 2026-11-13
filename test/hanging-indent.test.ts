import { describe, expect, it } from 'vitest'
import { hangingIndent, hangingStyle } from '../src/runtime/editor/plugins/codemirror-plugin-proses/proseHangingIndentPlugin'
import { state } from './helpers'

// Every character 10px wide, so expectations read as character counts.
const measure = (text: string) => text.length * 10

/** Hanging indent of the line containing `needle` (cursor on the first line unless `«»` says otherwise). */
function hang(src: string, needle: string) {
    const s = state(src)
    const pos = s.doc.toString().indexOf(needle)
    if (pos < 0) throw new Error(`"${needle}" not in doc`)
    const h = hangingIndent(s, s.doc.lineAt(pos), measure)
    return h && hangingStyle(h)
}

describe('hanging indent', () => {
    it('list items wrap at their text: indent levels, mark padding, and the mark with its space', () => {
        expect(hang('x\n\n- a', '- a')).toBe('--hang-padding: calc(1 * var(--list-padding-inline-start) + 20px); --hang-indent: calc(1 * var(--list-padding-inline-start) + 20px);')
        expect(hang('x\n\n- p\n\t- q\n\t\t- a', '- a')).toBe('--hang-padding: calc(2 * var(--list-indent) + 1 * var(--list-padding-inline-start) + 20px); --hang-indent: calc(2 * var(--list-indent) + 1 * var(--list-padding-inline-start) + 20px);')
        expect(hang('x\n\n9. a\n10. b', '10. b')).toContain('--hang-indent: calc(1 * var(--list-padding-inline-start) + 40px)')
    })

    it('a rendered task counts its checkbox; a revealed one its `- [ ] ` source', () => {
        expect(hang('x\n\n- [ ] a', '- [ ]')).toContain('--hang-indent: calc(1 * (var(--checkbox-size) + var(--checkbox-margin-inline-start) + var(--checkbox-margin-inline-end)) + 10px)')
        expect(hang('x\n\n- [«»x] a', '- [x]')).toContain('--hang-indent: calc(1 * var(--list-padding-inline-start) + 60px)')
    })

    it('quotes and indented lines wrap at their text', () => {
        expect(hang('> > quote', 'quote')).toBe('--hang-padding: calc(40px); --hang-indent: calc(40px);')
        expect(hang('para\n\tcontinued', 'continued')).toBe('--hang-padding: calc(1 * var(--list-indent)); --hang-indent: calc(1 * var(--list-indent));')
    })

    it('list continuations wrap at the item text, or their own if further right', () => {
        expect(hang('- item\n  lazy', 'lazy')).toBe('--hang-padding: max(calc(1 * var(--list-padding-inline-start) + 20px), calc(20px)); --hang-indent: calc(20px);')
        expect(hang('- item\n\n\tpara', 'para')).toBe('--hang-padding: max(calc(1 * var(--list-padding-inline-start) + 20px), calc(1 * var(--list-indent))); --hang-indent: calc(1 * var(--list-indent));')
    })

    it('none for plain lines, code, and blank lines', () => {
        expect(hang('plain', 'plain')).toBeNull()
        expect(hang('```\n\tcode\n```', 'code')).toBeNull()
        expect(hang('para\n\n\tindented code', 'indented')).toBeNull()
        expect(hang('- [ ] a\n\t```js\n\tx\n\t```', 'x')).toBeNull()
    })
})
