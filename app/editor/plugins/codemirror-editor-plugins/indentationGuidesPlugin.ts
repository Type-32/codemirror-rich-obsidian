import { Decoration, type DecorationSet, EditorView, MatchDecorator, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { StateField, type Extension, Line, RangeSetBuilder } from '@codemirror/state'

export interface IndentationGuidesSettings {
    showActiveIndentationGroup: boolean
    lists: boolean
    previewLists: boolean
    uncategorizedIndents: boolean
    code: boolean
}

export const DEFAULT_SETTINGS: IndentationGuidesSettings = {
    showActiveIndentationGroup: true,
    lists: true,
    previewLists: false,
    uncategorizedIndents: false,
    code: false,
}

function getLineIndent(line: Line) {
    const match = line.text.match(/^((?:\t| {4})+)/)

    if (!match) return 0

    return Math.max(match[1]?.split(/(?:\t| {4})/).length || 0, 1)
}

const tabMark = Decoration.mark({
    class: 'cm-indent',
})

const indentGroupMark = Decoration.mark({
    class: 'cm-indent cm-active-indent',
})

const indentationGroupDecoration = Decoration.line({
    attributes: { class: 'cm-indent-group' },
})

const activeIndentField = StateField.define<number>({
    create(state) {
        if (!state.selection?.main) return 0
        return getLineIndent(state.doc.lineAt(state.selection.main.from))
    },
    update(_, tr) {
        if (!tr.selection) return _.valueOf()
        const state = tr.state
        return getLineIndent(state.doc.lineAt(state.selection.main.from))
    },
})

const tabDecoration = (getSettings: () => IndentationGuidesSettings) => {
    return ViewPlugin.fromClass(
        class {
            decorator: MatchDecorator
            decorations: DecorationSet = Decoration.none

            constructor(public view: EditorView) {
                this.decorator = new MatchDecorator({
                    regexp: new RegExp(/(?:\t| {4})/g),
                    decoration: (match, view) => {
                        if (!getSettings().showActiveIndentationGroup) {
                            return tabMark
                        }

                        const currentIndent = Math.max(view.state.field(activeIndentField), 1)
                        const thisIndent = match.index / match[0].length + 1
                        console.log(thisIndent, currentIndent)

                        return thisIndent === currentIndent ? indentGroupMark : tabMark
                    },
                })

                this.decorations = this.decorator.createDeco(view)
            }

            update(update: ViewUpdate) {
                if (!getSettings().showActiveIndentationGroup) {
                    this.decorations = this.decorator.updateDeco(update, this.decorations)
                } else {
                    this.decorations = this.decorator.createDeco(update.view)
                }
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    )
}

function tagIndentationGroup(view: EditorView) {
    const builder = new RangeSetBuilder<Decoration>()
    const state = view.state

    if (!state.selection?.main) return builder.finish()

    const currentLine = state.doc.lineAt(state.selection.main.from)
    const currentIndent = view.state.field(activeIndentField)

    if (currentIndent === 0) return builder.finish()

    const indentationGroup: Line[] = [currentLine]

    let from: number = currentLine.from
    let to: number = currentLine.to

    while (from > 0) {
        const prevLine = state.doc.lineAt(from - 1)
        const prevIndent = getLineIndent(prevLine)

        if (prevIndent >= currentIndent) {
            indentationGroup.push(prevLine)
            from = prevLine.from
        } else {
            break
        }
    }

    while (to < state.doc.length - 1) {
        const nextLine = state.doc.lineAt(to + 1)
        const nextIndent = getLineIndent(nextLine)

        if (nextIndent >= currentIndent) {
            indentationGroup.push(nextLine)
            to = nextLine.to
        } else {
            break
        }
    }

    indentationGroup
        .sort((a, b) => a.from - b.from)
        .forEach((line) => {
            builder.add(line.from, line.from, indentationGroupDecoration)
        })

    return builder.finish()
}

const indentationGroup = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = tagIndentationGroup(view)
        }

        update(update: ViewUpdate) {
            this.decorations = tagIndentationGroup(update.view)
        }
    },
    {
        decorations: (v) => v.decorations,
    }
)

export const indentationGuides = (options: Partial<IndentationGuidesSettings> = {}): Extension => {
    const settings: IndentationGuidesSettings = { ...DEFAULT_SETTINGS, ...options }
    const getSettings = () => settings

    return [activeIndentField, indentationGroup, tabDecoration(getSettings)]
}
