import { describe, expect, it } from 'vitest'
import { EditorState, type Extension } from '@codemirror/state'
import { indentUnit } from '@codemirror/language'
import { deleteCharBackward, history, indentLess, indentMore, insertNewlineAndIndent, undo } from '@codemirror/commands'
import type { Command, EditorView } from '@codemirror/view'
import { indentListItem, insertListContinuation, insertListNewline, listEditing, listRenumbering, outdentListItem } from '../src/runtime/editor/plugins/codemirror-editor-plugins/listEditingPlugin'
import { parsed, state } from './helpers'

// Each key runs our command, then the default binding if ours passes, as the keymaps do in the editor.
const KEYS: Record<string, Command[]> = {
    'Enter': [insertListNewline, insertNewlineAndIndent],
    'Shift+Enter': [insertListContinuation, insertNewlineAndIndent],
    'Tab': [indentListItem, indentMore],
    'Shift+Tab': [outdentListItem, indentLess],
    'Backspace': [deleteCharBackward],
    'Mod-z': [undo],
}

/** Press `keys` on `src` (`«»` cursor, `«…»` selection); returns the text with the selection marked the same way. */
function press(src: string, keys: string[], extensions: Extension = []) {
    let s = state(src, [listEditing, indentUnit.of('\t'), extensions])
    const view = { get state() { return s }, dispatch: (tr: { state: EditorState }) => { s = parsed(tr.state) } } as unknown as EditorView
    for (const key of keys) {
        const commands = KEYS[key]
        if (commands) commands.some(c => c(view))
        else {
            const { from, to } = s.selection.main
            view.dispatch(s.update({ changes: { from, to, insert: key }, selection: { anchor: from + key.length }, userEvent: 'input.type' }))
        }
    }
    const { from, to } = s.selection.main
    const d = s.doc.toString()
    return from === to ? `${d.slice(0, from)}«»${d.slice(from)}` : `${d.slice(0, from)}«${d.slice(from, to)}»${d.slice(to)}`
}

// [name, source, keys, what Obsidian 1.12 produced]
type Case = [string, string, string[], string]
const run = (cases: Case[]) => {
    for (const [name, src, keys, expected] of cases) it(name, () => expect(press(src, keys)).toBe(expected))
}

describe('bullets, tasks and quotes', () => run([
    ['Enter mid bullet', '- ab«»cd', ['Enter'], '- ab\n- «»cd'],
    ['Enter at end of bullet', '- abc«»', ['Enter'], '- abc\n- «»'],
    ['Enter on empty top-level bullet ends the list', '- a\n- «»', ['Enter'], '- a\n«»'],
    ['Enter on empty nested bullet moves it up', '- a\n\t- «»', ['Enter'], '- a\n- «»'],
    ['Enter after a done task starts an open one', '- [x] done«»', ['Enter'], '- [x] done\n- [ ] «»'],
    ['Enter on empty task ends the list', '- [ ] a\n- [ ] «»', ['Enter'], '- [ ] a\n«»'],
    ['Enter at the start of a nested item keeps its mark', '1. a\n\t- «»b', ['Enter'], '1. a\n\t- \n\t- «»b'],
    ['Tab at content start', '- a\n- «»b', ['Tab'], '- a\n\t- «»b'],
    ['Tab mid text', '- a\n- b«»c', ['Tab'], '- a\n\t- b«»c'],
    ['Tab on the first item does nothing', '- «»a', ['Tab'], '- «»a'],
    ['Shift-Tab on nested item', '- a\n\t- «»b', ['Shift+Tab'], '- a\n- «»b'],
    ['Backspace at content start deletes the space', '- a\n- «»b', ['Backspace'], '- a\n-«»b'],
    ['Backspace at nested content start', '- a\n\t- «»b', ['Backspace'], '- a\n\t-«»b'],
    ['Backspace at task content start', '- [ ] «»b', ['Backspace'], '- [ ]«»b'],
    ['Shift-Enter continues the item text', '- ab«»', ['Shift+Enter'], '- ab\n  «»'],
    ['Enter in quote', '> ab«»', ['Enter'], '> ab\n> «»'],
    ['Enter on empty quote line ends the quote', '> a\n> «»', ['Enter'], '> a\n\n«»'],
    ['Enter in callout', '> [!note] T\n> body«»', ['Enter'], '> [!note] T\n> body\n> «»'],
    ['Typing "- " starts a list', '«»', ['-', ' '], '- «»'],
]))

describe('numbered lists', () => run([
    ['Enter at end of item', '1. a«»\n2. b', ['Enter'], '1. a\n2. «»\n3. b'],
    ['Enter mid item', '1. a«»b\n2. c', ['Enter'], '1. a\n2. «»b\n3. c'],
    ['Enter renumbers what follows', '1. a«»\n2. b\n3. c', ['Enter'], '1. a\n2. «»\n3. b\n4. c'],
    ['Enter on empty last item ends the list', '1. a\n2. «»', ['Enter'], '1. a\n«»'],
    ['Enter on empty middle item', '1. a\n2. «»\n3. c', ['Enter'], '1. a\n«»\n2. c'],
    ['Enter on empty nested item takes the next number up a level', '1. a\n\t1. «»', ['Enter'], '1. a\n2. «»'],
    ['Enter keeps the start number', '5. a«»\n6. b', ['Enter'], '5. a\n6. «»\n7. b'],
    ['Enter keeps the ) delimiter', '1) a«»\n2) b', ['Enter'], '1) a\n2) «»\n3) b'],
    ['Enter in a list numbered 1. 1. 1.', '1. a«»\n1. b\n1. c', ['Enter'], '1. a\n2. «»\n3. b\n4. c'],
    ['Enter from 9 to 10', '8. a\n9. b«»', ['Enter'], '8. a\n9. b\n10. «»'],
    ['Enter in a loose list stays tight', '1. a\n\n2. b«»', ['Enter'], '1. a\n\n2. b\n3. «»'],
    ['Tab starts a sublist at 1', '1. a\n2. «»b\n3. c', ['Tab'], '1. a\n\t1. «»b\n2. c'],
    ['Tab takes the children along', '1. a\n2. «»b\n\t1. b1\n3. c', ['Tab'], '1. a\n\t1. «»b\n\t\t1. b1\n2. c'],
    ['Tab joins an existing sublist', '1. a\n\t1. a1\n2. «»b', ['Tab'], '1. a\n\t1. a1\n\t2. «»b'],
    ['Shift-Tab renumbers both levels', '1. a\n\t1. a1\n\t2. «»a2\n2. b', ['Shift+Tab'], '1. a\n\t1. a1\n2. «»a2\n3. b'],
    ['Shift-Tab on the only nested item', '1. a\n\t1. «»a1\n2. b', ['Shift+Tab'], '1. a\n2. «»a1\n3. b'],
    ['Backspace at content start splits the list', '1. a\n2. «»b\n3. c', ['Backspace'], '1. a\n2.«»b\n2. c'],
    ['Deleting an item renumbers', '1. a\n«2. b\n»3. c', ['Backspace'], '1. a\n«»2. c'],
    ['Typing an item before a list renumbers it', '«»\n1. a', ['1', '.', ' '], '1. «»\n2. a'],
    ['Typing the next number', '1. a\n«»', ['2', '.', ' '], '1. a\n2. «»'],
    ['Shift-Enter indents to the text', '1. ab«»', ['Shift+Enter'], '1. ab\n   «»'],
    ['Ordered sublist under a bullet', '- a\n\t1. x«»', ['Enter'], '- a\n\t1. x\n\t2. «»'],
]))

describe('tab indentation', () => run([
    ['Tab at start of a paragraph line', 'para\n«»text', ['Tab'], 'para\n\t«»text'],
    ['Tab with a multi-line selection', '«a\nb»', ['Tab'], '\t«a\n\tb»'],
    ['Shift-Tab on a 4-space line', '    te«»xt', ['Shift+Tab'], 'te«»xt'],
    ['Enter after a tab-indented line keeps the indent', '\ttext«»', ['Enter'], '\ttext\n\t«»'],
    ['Enter on a whitespace-only line clears it', '\t«»', ['Enter'], '«»'],
    ['Backspace after a leading tab', '\t«»text', ['Backspace'], '«»text'],
    ['Tab in a code block', '```\nco«»de\n```', ['Tab'], '```\n\tco«»de\n```'],
    ['Enter in an indented code line', '```\n\tcode«»\n```', ['Enter'], '```\n\tcode\n\t«»\n```'],
    ['Tab in a quote goes after the >', '> quo«»te', ['Tab'], '> \tquo«»te'],
]))

describe('renumbering', () => {
    it('joins lists split by blank lines or a delimiter change', () => {
        expect(press('1. a«»\n\n1) b', ['Enter'])).toBe('1. a\n2. «»\n\n3) b')
    })
    it('leaves lists the edit did not touch, and programmatic changes', () => {
        expect(press('1. a«»\n\npara\n\n1. x\n1. y', ['Enter'])).toBe('1. a\n2. «»\n\npara\n\n1. x\n1. y')
        const s = state('1. a\n1. b', [listEditing])
        expect(s.update({ changes: { from: 0, insert: 'x\n\n' } }).state.doc.toString()).toBe('x\n\n1. a\n1. b')
    })
    it('is one undo step with the edit, and can be turned off', () => {
        expect(press('1. a«»\n2. b', ['Enter', 'Mod-z'], history())).toBe('1. a«»\n2. b')
        expect(press('1. a«»\n2. b', ['Enter'], listRenumbering.of(false))).toBe('1. a\n2. «»\n2. b')
    })
})
