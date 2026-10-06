import { Decoration, type DecorationSet, EditorView, MatchDecorator, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { StateField, type Extension } from '@codemirror/state'
import { indentLevel } from '../../utility/tools'

const tabMark = Decoration.mark({ class: 'cm-indent' })
const activeTabMark = Decoration.mark({ class: 'cm-indent cm-active-indent' })
const groupLine = Decoration.line({ attributes: { class: 'cm-indent-group' } })

/** Indent level (tabs / 4-space groups) of the line holding the main cursor. */
const activeIndentField = StateField.define<number>({
    create: state => indentLevel(state.doc.lineAt(state.selection.main.from).text),
    update: (value, tr) => tr.selection || tr.docChanged ? indentLevel(tr.state.doc.lineAt(tr.state.selection.main.from).text) : value,
})

/** Wraps each leading tab / 4-space group in `.cm-indent`; the one at the cursor's depth gets `.cm-active-indent`. */
const tabGuides = ViewPlugin.fromClass(class {
    decorations: DecorationSet
    private decorator = new MatchDecorator({
        regexp: /^(?:\t| {4})+/g,
        decorate: (add, from, _to, match, view) => {
            const active = view.state.field(activeIndentField)
            const text = match[0]
            for (let i = 0, level = 1; i < text.length; level++) {
                const w = text[i] === '\t' ? 1 : 4
                add(from + i, from + i + w, level === active ? activeTabMark : tabMark)
                i += w
            }
        },
    })

    constructor(view: EditorView) {
        this.decorations = this.decorator.createDeco(view)
    }

    update(u: ViewUpdate) {
        this.decorations = u.startState.field(activeIndentField) !== u.state.field(activeIndentField)
            ? this.decorator.createDeco(u.view)
            : this.decorator.updateDeco(u, this.decorations)
    }
}, { decorations: v => v.decorations })

/** Marks the contiguous block of lines around the cursor whose indent is ≥ the cursor's. */
const indentGroup = ViewPlugin.fromClass(class {
    decorations: DecorationSet

    constructor(view: EditorView) {
        this.decorations = this.build(view)
    }

    update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = this.build(u.view)
    }

    build(view: EditorView) {
        const { state } = view
        const level = state.field(activeIndentField)
        if (level === 0) return Decoration.none
        const doc = state.doc
        const cur = doc.lineAt(state.selection.main.from)
        let first = cur.number, last = cur.number
        while (first > 1 && indentLevel(doc.line(first - 1).text) >= level) first--
        while (last < doc.lines && indentLevel(doc.line(last + 1).text) >= level) last++
        const out = []
        for (let n = first; n <= last; n++) out.push(groupLine.range(doc.line(n).from))
        return Decoration.set(out)
    }
}, { decorations: v => v.decorations })

export const indentationGuides = (): Extension => [activeIndentField, indentGroup, tabGuides]
