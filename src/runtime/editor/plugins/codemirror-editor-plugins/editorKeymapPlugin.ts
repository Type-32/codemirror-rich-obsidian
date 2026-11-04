import { keymap } from '@codemirror/view'
import { completionKeymap } from '@codemirror/autocomplete'
import { toggleMark } from '../../../kit/commands'

export const editorKeymapPlugin = keymap.of([
    {
        key: 'Mod-b',
        run: toggleMark('bold'),
    },
    {
        key: 'Mod-i',
        run: toggleMark('italic'),
    },
    {
        key: 'Mod-Shift-x',
        run: toggleMark('strikethrough'),
    },
    {
        key: 'Mod-Shift-h',
        run: toggleMark('highlight'),
    },
    ...completionKeymap,
])
