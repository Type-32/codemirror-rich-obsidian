import { computed, ref, unref, watch } from 'vue'
import { EditorView } from '@codemirror/view'
import type { SyntaxNode, Tree } from '@lezer/common'
import type { Ref } from 'vue'
import type { TransactionSpec } from '@codemirror/state'
import { parseMarkdownToAST } from '../utils/markdownParser'
import type { SearchMatch, SearchOptions } from '../editor/types/editor-types'

export function useEditorUtils(editor: Ref<any>) {
	const view = computed(() => {
		const instance = unref(editor)
		if (!instance) return
		return instance.view ?? instance
	})

	const searchResults = ref<SearchMatch[]>([])
	const currentMatchIndex = ref(-1)
	const searchQuery = ref<SearchOptions | null>(null)

	/**
	 * Helper: Creates a regex from search options
	 */
	function createSearchRegex(options: SearchOptions): RegExp {
		return new RegExp(options.query, options.caseSensitive ? 'g' : 'gi')
	}

	/**
	 * Helper: Finds all matches in the document for the given search options
	 */
	function findAllMatches(doc: string, options: SearchOptions): SearchMatch[] {
		const matches: SearchMatch[] = []
		const regex = createSearchRegex(options)
		let match
		while ((match = regex.exec(doc)) !== null) {
			matches.push({ from: match.index, to: match.index + match[0].length })
		}
		return matches
	}

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
        const firstChild = ast.topNode.firstChild
        return firstChild?.name === 'Frontmatter' || firstChild?.name === 'YAMLFrontMatter'
    }

	function search(options: SearchOptions) {
		searchQuery.value = options
		const doc = getDoc()
		if (!doc || !options.query) {
			searchResults.value = []
			currentMatchIndex.value = -1
			return
		}

		searchResults.value = findAllMatches(doc, options)
		currentMatchIndex.value = -1 // No selection initially
	}

	function selectAndScrollToMatch(match: SearchMatch, verticalMargin?: number) {
		const editorView = unref(view)
		if (!editorView || !match) return
		editorView.dispatch({
			selection: { anchor: match.from, head: match.to },
			effects: EditorView.scrollIntoView(match.from, { y: 'start', yMargin: verticalMargin }),
		})
	}

	function findNext() {
		if (searchResults.value.length === 0) return
		const nextIndex = (currentMatchIndex.value + 1) % searchResults.value.length
		currentMatchIndex.value = nextIndex
		if (!searchResults.value[nextIndex]) {
			return
		}
		selectAndScrollToMatch(searchResults.value[nextIndex])
	}

	function findPrevious() {
		if (searchResults.value.length === 0) return
		const prevIndex = (currentMatchIndex.value - 1 + searchResults.value.length) % searchResults.value.length
		currentMatchIndex.value = prevIndex
		if (!searchResults.value[prevIndex]) {
			return
		}
		selectAndScrollToMatch(searchResults.value[prevIndex])
	}

	function replaceCurrent(replacement: string) {
		if (currentMatchIndex.value < 0 || currentMatchIndex.value >= searchResults.value.length) {
			findNext()
			return
		}
		const match = searchResults.value[currentMatchIndex.value]
		if (!match) {
			findNext()
			return
		}
		dispatch({
			changes: { from: match.from, to: match.to, insert: replacement },
		})

		if (searchQuery.value) {
			search(searchQuery.value)
		}
	}

	function replaceAll(replacement: string) {
		if (!searchQuery.value || !searchQuery.value.query) return
		const doc = getDoc()
		if (!doc) return

		const matches = findAllMatches(doc, searchQuery.value)

		if (matches.length === 0) return

		const changes = matches.map(m => ({
			from: m.from,
			to: m.to,
			insert: replacement,
		}))

		dispatch({ changes })
		searchResults.value = []
		currentMatchIndex.value = -1
	}

	function scrollToNode(node: SyntaxNode, verticalMargin?: number) {
		const editorView = unref(view)
		if (!editorView || !node) return
		editorView.dispatch({
			effects: EditorView.scrollIntoView(node.from, { y: 'start', yMargin: verticalMargin }),
		})
	}

	return {
		getDoc,
		setDoc,
		getSelection,
		replaceSelection,
		dispatch,
		parseMarkdownToAST, // Re-exported from utils for convenience
		getDocAst,
		findNodesByType,
		getDocNodesByType,
		hasFrontmatter,
		search,
		replaceAll,
		searchResults,
		currentMatchIndex,
		findNext,
		findPrevious,
		replaceCurrent,
		scrollToNode,
	}
}
