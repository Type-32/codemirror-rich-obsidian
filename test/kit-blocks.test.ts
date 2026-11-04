import { describe, expect, it } from 'vitest'
import type { EditorState } from '@codemirror/state'
import { blockAt, canMoveBlock, deleteBlock, dropTarget, moveBlock, moveBlockTo, type Block, type Side } from '../src/runtime/kit/blocks'
import { insertBlock, setLinePrefix } from '../src/runtime/kit/commands'
import { exec, state } from './helpers'

const at = (s: EditorState, needle: string) => {
    const pos = s.doc.toString().indexOf(needle)
    if (pos < 0) throw new Error(`"${needle}" not in doc`)
    return blockAt(s, pos)!
}
const text = (s: EditorState, b: Block | null) => (b ? s.sliceDoc(b.from, b.to) : null)

/** Move the block containing `what` before/after the block containing `where`. */
function move(doc: string, what: string, where: string, side: Side) {
    const s = state(doc)
    return exec(s, moveBlockTo(at(s, what), at(s, where), side))
}

describe('blockAt', () => {
    const doc = '---\na: 1\n---\n\n# Title\n\nPara one\nstill one\n\n- a\n\t- a1\n\t- a2\n- b\n\n> [!note] T\n> body\n\n| x | y |\n| - | - |\n| 1 | 2 |'
    const s = state(doc)
    it('frontmatter and blank lines are not blocks', () => {
        expect(blockAt(s, 4)).toBeNull()
        expect(blockAt(s, doc.indexOf('\n\nPara') + 1)).toBeNull()
    })
    it('top-level blocks cover all their lines, even from a line end', () => {
        expect(text(s, at(s, 'still'))).toBe('Para one\nstill one')
        expect(text(s, blockAt(s, doc.indexOf('one\nstill') + 3))).toBe('Para one\nstill one')
        expect(text(s, at(s, 'Title'))).toBe('# Title')
        expect(text(s, at(s, '| 1'))).toBe('| x | y |\n| - | - |\n| 1 | 2 |')
    })
    it('list items are the innermost item, with their children', () => {
        expect(text(s, at(s, '- a\n'))).toBe('- a\n\t- a1\n\t- a2')
        expect(text(s, at(s, 'a1'))).toBe('\t- a1')
    })
    it('a callout is one block', () => {
        expect(text(s, at(s, 'body'))).toBe('> [!note] T\n> body')
    })
})

describe('moveBlockTo', () => {
    it('pads blank lines so moved paragraphs never fuse with neighbours', () => {
        expect(move('A\n\nB\n\nC', 'A', 'C', 'after').text).toBe('B\n\nC\n\nA')
        expect(move('# H\nA\n\nB', 'B', 'A', 'before').text).toBe('# H\n\nB\n\nA')
    })
    it('keeps two callouts apart', () => {
        expect(move('> [!a] x\n\npara\n\n> [!b] y', '[!a]', '[!b]', 'before').text).toBe('para\n\n> [!a] x\n\n> [!b] y')
    })
    it('moves a list item with its children into another list, re-indented and re-marked', () => {
        const r = move('- a\n\t- a1\n- b\n\n* x\n* y', '- a\n', 'y', 'after')
        expect(r.text).toBe('- b\n\n* x\n* y\n* a\n\t- a1')
    })
    it('nested item dropped among top-level items is dedented', () => {
        expect(move('- a\n\t- a1\n- b', 'a1', '- b', 'after').text).toBe('- a\n- b\n- a1')
    })
    it('a list item dropped next to a paragraph becomes a standalone list; ordered restarts at 1', () => {
        expect(move('1. x\n2. y\n\nP', 'y', 'P', 'after').text).toBe('1. x\n\nP\n\n1. y')
    })
    it('a paragraph dropped onto a list item goes beside the whole list', () => {
        expect(move('P\n\n- a\n- b', 'P', 'b', 'after').text).toBe('- a\n- b\n\nP')
    })
    it('renumbers ordered lists on both ends', () => {
        expect(move('1. a\n2. b\n3. c', 'a', 'c', 'after').text).toBe('1. b\n2. c\n3. a')
        expect(move('3. a\n4. b\n\n1. x', 'x', 'a', 'before').text).toBe('3. x\n4. a\n5. b')
    })
    it('keeps a loose list loose', () => {
        expect(move('- a\n\n- b\n\n- c', 'a', 'c', 'after').text).toBe('- b\n\n- c\n\n- a')
    })
    it('rejects no-ops and drops into its own subtree', () => {
        const s = state('A\n\nB\n\n- p\n\t- c')
        expect(dropTarget(s, at(s, 'A'), at(s, 'B'), 'before')).toBeNull()
        expect(dropTarget(s, at(s, 'B'), at(s, 'A'), 'after')).toBeNull()
        expect(dropTarget(s, at(s, 'A'), at(s, 'A'), 'after')).toBeNull()
        expect(dropTarget(s, at(s, '- p'), at(s, 'c'), 'after')).toBeNull()
        expect(text(s, dropTarget(s, at(s, 'A'), at(s, 'B'), 'after'))).toBe('B')
    })
    it('a non-item dropped on a list item targets the whole list', () => {
        const s = state('A\n\n- p\n\t- c')
        expect(text(s, dropTarget(s, at(s, 'A'), at(s, 'c'), 'after'))).toBe('- p\n\t- c')
    })
    it('a child can move out before its parent', () => {
        expect(move('- p\n\t- c\n- q', 'c', '- p', 'before').text).toBe('- c\n- p\n- q')
    })
    it('is a single undoable change', () => {
        const r = move('A\n\nB', 'A', 'B', 'after')
        expect(r.ok).toBe(true)
        expect(r.text).toBe('B\n\nA')
    })
})

describe('moveBlock', () => {
    it('swaps with the previous/next sibling and stops at boundaries', () => {
        const s = state('---\nx: 1\n---\n\nA\n\nB')
        expect(canMoveBlock(s, at(s, 'A'), -1)).toBe(false) // frontmatter is pinned
        expect(exec(s, moveBlock(at(s, 'A'), 1)).text).toBe('---\nx: 1\n---\n\nB\n\nA')
        const l = state('- a\n- b\n\nP')
        expect(canMoveBlock(l, at(l, 'b'), 1)).toBe(false) // last item: no sibling in its list
        expect(exec(l, moveBlock(at(l, 'b'), -1)).text).toBe('- b\n- a\n\nP')
    })
})

describe('deleteBlock', () => {
    const del = (doc: string, what: string) => { const s = state(doc); return exec(s, deleteBlock(at(s, what))).text }
    it('collapses the gap to one blank line', () => {
        expect(del('A\n\nB\n\nC', 'B')).toBe('A\n\nC')
        expect(del('# H\nB\nC', '# H')).toBe('B\nC')
        expect(del('A\n\nB', 'B')).toBe('A')
    })
    it('removes a list item with its children and renumbers', () => {
        expect(del('1. a\n\t- a1\n2. b\n3. c', '1. a')).toBe('1. b\n2. c')
        expect(del('- only\n\nP', 'only')).toBe('P')
    })
})

describe('setLinePrefix', () => {
    it('replaces whatever block prefix the line has, keeping indentation and text', () => {
        expect(exec('# Ti«»tle', setLinePrefix('- ')).text).toBe('- Title')
        expect(exec('\t- [ ] t«»ask', setLinePrefix('1. ')).text).toBe('\t1. task')
        expect(exec('> [!note] x«»', setLinePrefix('## ')).text).toBe('## x')
        expect(exec('## «»x', setLinePrefix('')).text).toBe('x')
    })
    it('puts the cursor after the new prefix on an empty line', () => {
        expect(exec('«»', setLinePrefix('> [!note] '))).toMatchObject({ text: '> [!note] ', sel: '' })
        expect(exec('«»', setLinePrefix('# ')).state.selection.main.head).toBe(2)
    })
})

describe('insertBlock', () => {
    it('replaces a blank line, cursor between before/after', () => {
        const r = exec('«»', insertBlock('```\n', '\n```'))
        expect(r.text).toBe('```\n\n```')
        expect(r.state.selection.main.head).toBe(4)
    })
    it('goes below a filled line after a blank line', () => {
        expect(exec('text«»', insertBlock('---\n')).text).toBe('text\n\n---\n')
    })
    it('keeps a blank line before following content', () => {
        expect(exec('«»\nnext', insertBlock('| a |\n| - |\n')).text).toBe('| a |\n| - |\n\n\nnext')
    })
})
