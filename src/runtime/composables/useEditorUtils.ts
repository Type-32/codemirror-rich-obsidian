import { computed, ref, unref, watch } from 'vue'
import type { EditorView } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import type { SyntaxNode, Tree } from '@lezer/common'
import type { Ref } from 'vue'
import type { TransactionSpec } from '@codemirror/state'

export function useEditorUtils(editor: Ref<any>) {
	const view = computed(() => {
		const instance = unref(editor)
		if (!instance) return
		return instance.view ?? instance
	})

	function getDoc(): string | undefined {
		return unref(view)?.state.doc.toString()
	}

	function setDoc(content: string) {
		unref(view)?.dispatch({
			changes: { from: 0, to: unref(view)!.state.doc.length, insert: content },
		})
	}

	function getSelection() {
		return unref(view)?.state.selection.main
	}

	function replaceSelection(text: string) {
		unref(view)?.dispatch(unref(view)!.state.replaceSelection(text))
	}

	function dispatch(...specs: TransactionSpec[]) {
		unref(view)?.dispatch(...specs)
	}

	function parseMarkdownToAST(markdownText: string): Tree {
		return markdown().language.parser.parse(markdownText)
	}

    function getDocAst(): Tree {
        return parseMarkdownToAST(getDoc() || '') as Tree
    }

	function findNodesByType(tree: Tree, nodeTypeName: string): SyntaxNode[] {
		const nodes: SyntaxNode[] = []
		tree.iterate({
			enter: (node) => {
				if (node.type.name === nodeTypeName) {
					nodes.push(node.node)
				}
			},
		})
		return nodes
	}

    function getDocNodesByType(nodeTypeName: string): SyntaxNode[] {
        return findNodesByType(getDocAst(), nodeTypeName)
    }

    function hasFrontmatter(): boolean {
        const ast = getDocAst()
        if (!ast) return false
        return ast.topNode.firstChild?.name === 'YAMLFrontMatter'
    }

	return {
		getDoc,
		setDoc,
		getSelection,
		replaceSelection,
		dispatch,
		parseMarkdownToAST,
		getDocAst,
		findNodesByType,
		getDocNodesByType,
		hasFrontmatter,
	}
}
