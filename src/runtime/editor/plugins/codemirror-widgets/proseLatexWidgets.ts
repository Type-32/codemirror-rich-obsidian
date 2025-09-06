import {type EditorView, WidgetType} from "@codemirror/view";
import {syntaxTree} from "@codemirror/language";
import katex from "katex";

export class InlineLatexWidget extends WidgetType {
    constructor (private readonly content: string) {
        super()
    }

    toDOM (view: EditorView): HTMLElement {
        const container = document.createElement('span')
        katex.render(this.content, container, {
            throwOnError: false
        })

        container.addEventListener('click', () => {
            const pos = view.posAtDOM(container)
            const tree = syntaxTree(view.state)
            const node = tree.resolve(pos)
            if (node.name === 'TexInline') {
                view.dispatch({
                    selection: { anchor: node.from, head: node.to }
                })
            }
        })

        return container
    }
}


export class BlockLatexWidget extends WidgetType {
    constructor (private readonly content: string) {
        super()
    }

    toDOM (view: EditorView): HTMLElement {
        const container = document.createElement('div')
        katex.render(this.content, container, {
            throwOnError: false,
            displayMode: true
        })

        container.addEventListener('click', () => {
            const pos = view.posAtDOM(container)
            const tree = syntaxTree(view.state)
            const node = tree.resolve(pos)
            if (node.name === 'TexBlock') {
                view.dispatch({
                    selection: { anchor: node.from, head: node.to }
                })
            }
        })

        return container
    }
}