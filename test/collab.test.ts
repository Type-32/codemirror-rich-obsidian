import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { textChanges, type TextChange } from '../src/runtime/editor/utility/textChanges'
import { editProperties, frontmatterOf, setProperty } from '../src/runtime/editor/utility/properties'
import { insertCol, parseTable, serializeTable } from '../src/runtime/utils/markdownTable'
import { listEditing, listRenumbering, renumberAt } from '../src/runtime/editor/plugins/codemirror-editor-plugins/listEditingPlugin'
import type { Transaction } from '@codemirror/state'
import { state } from './helpers'

/**
 * Two peers start from `base`, each applies its own changes offline, then they exchange updates. Yjs orders
 * concurrent inserts at one position by client id, so tests that care run both `ids` orders.
 */
function merge(base: string, a: TextChange[], b: TextChange[], ids = [1, 2]): string {
    const docs = ids.map((id) => {
        const doc = new Y.Doc()
        doc.clientID = id
        return doc
    })
    docs[0]!.getText().insert(0, base)
    Y.applyUpdate(docs[1]!, Y.encodeStateAsUpdate(docs[0]!))
    docs.forEach((doc, i) => {
        const text = doc.getText()
        // Changes are in `base` positions; apply from the end so earlier ones stay valid.
        for (const c of [...(i ? b : a)].reverse()) {
            if (c.to > c.from) text.delete(c.from, c.to - c.from)
            if (c.insert) text.insert(c.from, c.insert)
        }
    })
    Y.applyUpdate(docs[0]!, Y.encodeStateAsUpdate(docs[1]!))
    Y.applyUpdate(docs[1]!, Y.encodeStateAsUpdate(docs[0]!))
    const [x, y] = docs.map(d => d.getText().toString())
    expect(x).toBe(y)
    return x!
}

/** A peer's edit as the editor writes it: the changes from `base` to `next`. */
const edit = (base: string, next: string) => textChanges(base, next)

/** A transaction's changes, in its start document's positions. */
function changesOf(tr: Transaction): TextChange[] {
    const out: TextChange[] = []
    tr.changes.iterChanges((from, to, _fromB, _toB, text) => out.push({ from, to, insert: text.toString() }))
    return out
}

describe('textChanges', () => {
    it('turns one text into the other', () => {
        for (const [a, b] of [['abc', 'abc'], ['', 'x'], ['x', ''], ['a b c', 'a X c Y'], ['| a | b |\n| c | d |', '| a | b | x |\n| c | d |   |']]) {
            let out = a!
            for (const c of [...textChanges(a!, b!)].reverse()) out = out.slice(0, c.from) + c.insert + out.slice(c.to)
            expect(out).toBe(b)
        }
    })
})

describe('concurrent edits merge where they were made', () => {
    it('properties: two peers edit different keys (F1)', () => {
        const yaml = 'status: draft\ntags:\n  - lab\n'
        const base = frontmatterOf(yaml)
        const a = frontmatterOf(editProperties(yaml, d => setProperty(d, ['status'], 'done')))
        const b = frontmatterOf(editProperties(yaml, d => setProperty(d, ['tags'], ['lab', 'collab'])))
        expect(merge(base, edit(base, a), edit(base, b))).toBe('---\nstatus: done\ntags:\n  - lab\n  - collab\n---')
    })

    it('tables: a column added while a cell is typed in (F2)', () => {
        const base = '| a | b |\n| - | - |\n| c | d |'
        const added = serializeTable(insertCol(parseTable(base)!, 2))
        const typed = base.replace('| d |', '| dB |')
        // Whichever peer Yjs orders first: the new column, and the typed text in its own cell.
        for (const ids of [[1, 2], [2, 1]]) {
            const table = parseTable(merge(base, edit(base, added), edit(base, typed), ids))!
            expect(table.header).toEqual(['a', 'b', ''])
            expect(table.rows[0]).toEqual(['c', 'dB', ''])
        }
    })

    it('lists: only the elected peer renumbers, and it repairs after the others (F3)', () => {
        const base = '1. one\n2. two\n3. three'
        const type = (renumber: boolean | (() => boolean), after: string, text: string) => {
            const s = state(base, [listEditing, listRenumbering.of(renumber)])
            return s.update({ changes: { from: base.indexOf(after) + after.length, insert: text }, userEvent: 'input.type' })
        }
        const leader = type(() => true, '1. one', '\n2. a')
        const other = type(false, '2. two', '\n3. b')
        expect(leader.state.doc.toString()).toBe('1. one\n2. a\n3. two\n4. three')
        expect(other.state.doc.toString()).toBe('1. one\n2. two\n3. b\n3. three')

        const merged = merge(base, changesOf(leader), changesOf(other))
        expect(merged).toBe('1. one\n2. a\n3. two\n3. b\n4. three')
        // The leader receives the other's item as a remote change and renumbers after it.
        const s = state(merged)
        const at = merged.indexOf('3. b')
        const repaired = s.update({ changes: renumberAt(s, [at, at + 4]) }).state.doc.toString()
        expect(repaired).toBe('1. one\n2. a\n3. two\n4. b\n5. three')
    })
    it('a host rewriting the note keeps a concurrent edit where it was typed (F6)', () => {
        const base = '# Note\n\none two three\n\nEnd\n'
        const host = base.replace('two', 'TWO')
        const typed = base.replace('End', 'End by B')
        expect(merge(base, edit(base, host), edit(base, typed))).toBe('# Note\n\none TWO three\n\nEnd by B\n')
    })
})
