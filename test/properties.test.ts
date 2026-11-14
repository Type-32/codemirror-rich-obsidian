import { describe, expect, it } from 'vitest'
import { EditorSelection } from '@codemirror/state'
import { convertValue, editProperties, inferType, propertiesYaml, removeProperty, renameProperty, setProperty } from '../src/runtime/editor/utility/properties'
import { panelEnd, propertiesPanel } from '../src/runtime/editor/plugins/codemirror-plugin-proses/propertiesPlugin'
import { state } from './helpers'
import { linkCompletions, wikilink } from '../src/runtime/components/Editor/properties'

const YAML = 'tags:\n  - kthalatir\n  - lab/parity\n# where the image is\ncover: "[[Kthalatir.png]]"\nstatus: draft\nempty:\nflow: [a, b]\nnested:\n  a: 1\n  b: two\n'

describe('property edits keep the YAML as written', () => {
    it('setting a value keeps comments, order, quoting and flow style', () => {
        const out = editProperties(YAML, (d) => {
            setProperty(d, ['status'], 'done')
            setProperty(d, ['cover'], '[[Other.png]]')
            setProperty(d, ['flow'], ['a', 'b', 'c'])
            setProperty(d, ['nested', 'b'], 'three')
        })
        expect(out).toBe('tags:\n  - kthalatir\n  - lab/parity\n# where the image is\ncover: "[[Other.png]]"\nstatus: done\nempty:\nflow: [a, b, c]\nnested:\n  a: 1\n  b: three\n')
    })

    it('renaming keeps the position and the comment above', () => {
        expect(editProperties(YAML, d => renameProperty(d, ['cover'], 'image')))
            .toContain('# where the image is\nimage: "[[Kthalatir.png]]"\nstatus: draft')
        expect(editProperties(YAML, d => renameProperty(d, ['nested', 'a'], 'z'))).toContain('nested:\n  z: 1\n  b: two')
    })

    it('refuses an empty or duplicate name', () => {
        expect(editProperties(YAML, d => renameProperty(d, ['cover'], 'status'))).toBe(YAML)
        expect(editProperties(YAML, d => renameProperty(d, ['cover'], ''))).toBe(YAML)
    })

    it('adds empty properties as `key:`, writes lists in block style, and empties to nothing', () => {
        expect(editProperties('', d => setProperty(d, ['new'], null))).toBe('new:\n')
        expect(editProperties('a: 1\n', d => setProperty(d, ['tags'], ['x', 'y']))).toBe('a: 1\ntags:\n  - x\n  - y\n')
        expect(editProperties('a: 1\n', d => removeProperty(d, ['a']))).toBe('')
    })
})

describe('property types', () => {
    it('are inferred like Obsidian, with tags/aliases by name', () => {
        expect([
            inferType('tags', ['a']), inferType('aliases', []), inferType('x', ['a', 1]), inferType('x', [{ a: 1 }]), inferType('x', true),
            inferType('x', 4), inferType('x', '2026-11-13'), inferType('x', '2026-11-13T03:20'), inferType('x', { a: 1 }), inferType('x', null), inferType('x', 'hi'),
        ]).toEqual(['tags', 'aliases', 'list', 'unknown', 'checkbox', 'number', 'date', 'datetime', 'object', 'text', 'text'])
    })

    it('convert values when the type changes', () => {
        expect(convertValue('a', 'list')).toEqual(['a'])
        expect(convertValue(['a', 'b'], 'text')).toBe('a, b')
        expect(convertValue('12', 'number')).toBe(12)
        expect(convertValue('twelve', 'number')).toBeNull()
        expect(convertValue('2026-11-13T03:20', 'date')).toBe('2026-11-13')
        expect(convertValue('2026-11-13', 'datetime')).toBe('2026-11-13T00:00')
        expect(convertValue('true', 'checkbox')).toBe(true)
    })
})

describe('frontmatter', () => {
    it('is shown as properties only when it is a mapping (or empty)', () => {
        expect(propertiesYaml('---\na: 1\n---')).toBe('a: 1\n')
        expect(propertiesYaml('---\n---')).toBe('')
        expect(propertiesYaml('---\n- a list\n---')).toBeNull()
        expect(propertiesYaml('---\na: [\n---')).toBeNull()
    })
})

describe('the panel', () => {
    const DOC = '---\na: 1\n---\nbody'
    const panel = (doc: string, sel = doc.length) => state(doc.slice(0, sel) + '«»' + doc.slice(sel), propertiesPanel())

    it('replaces valid frontmatter only', () => {
        expect(panelEnd(panel(DOC))).toBe(12)
        expect(panelEnd(panel('---\n- list\n---\nbody'))).toBeNull()
        expect(panelEnd(panel('no frontmatter'))).toBeNull()
    })

    it('keeps typing and deleting out of the frontmatter, but not the body or programmatic edits', () => {
        const at = panel(DOC, 13)
        const typed = (from: number, to: number, insert = '') => at.update({ changes: { from, to, insert }, userEvent: 'input' }).state.doc.toString()
        expect(typed(13, 13, 'x')).toBe('---\na: 1\n---\nxbody') // start of the body
        expect(typed(12, 13)).toBe(DOC) // Backspace at the start of the body
        expect(typed(0, 0, 'x')).toBe(DOC) // before the panel
        expect(typed(0, DOC.length)).toBe('---\na: 1\n---\n') // select all + delete keeps the frontmatter
        expect(at.update({ changes: { from: 4, to: 8, insert: 'b: 2' } }).state.doc.toString()).toBe('---\nb: 2\n---\nbody')
    })

    it('moves a cursor before or inside the panel to the start of the body', () => {
        const s = panel(DOC, 13)
        expect(s.update({ selection: { anchor: 0 } }).state.selection.main.head).toBe(13)
        expect(s.update({ selection: EditorSelection.range(0, DOC.length) }).state.selection.main.from).toBe(13)
    })
})

describe('links in values', () => {
    it('shows links and embeds as links', () => {
        expect(wikilink('[[Lab#x|Shown]]')).toEqual({ target: 'Lab', text: 'Shown' })
        expect(wikilink('![[Kthalatir.png]]')).toEqual({ target: 'Kthalatir.png', text: 'Kthalatir.png' })
        expect(wikilink('text [[Lab]]')).toBeNull()
    })

    it('completes an open `[[` like the editor: matches name or path; shared names complete to the path', () => {
        const links = [{ name: 'Lab', referenceId: '1' }, { name: 'Note', filePath: 'a/Note.md', referenceId: '2' }, { name: 'Note', filePath: 'b/Note.md', referenceId: '3' }]
        expect(linkCompletions('plain', links)).toBeNull()
        expect(linkCompletions('see [[la', links)!.map(c => c.value)).toEqual(['see [[Lab]]'])
        expect(linkCompletions('![[b/', links)!.map(c => c.value)).toEqual(['![[b/Note.md]]'])
        expect(linkCompletions('[[', links)).toHaveLength(3)
        expect(linkCompletions('[[Lab]] x', links)).toBeNull()
    })
})
