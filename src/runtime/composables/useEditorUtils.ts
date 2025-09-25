import { computed, ref, unref, watch } from 'vue'
import type { EditorView } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import type { SyntaxNode, Tree } from '@lezer/common'
import type { Ref } from 'vue'
import type { TransactionSpec } from '@codemirror/state'
import { CustomOFM } from '../../runtime/editor/lezer-parsers/customOFMParsers'
import { GFM, type MarkdownExtension } from '@lezer/markdown'
import type { SearchMatch } from '../editor/types/editor-types';

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
		return markdown({
			extensions: [
				GFM,
				CustomOFM as MarkdownExtension[],
				{ remove: ['SetextHeading'] }
			]
		}).language.parser.parse(markdownText)
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

    function search(query: string, options: { caseSensitive?: boolean } = {}): SearchMatch[] {
        const doc = getDoc();
        if (!doc || !query) return [];

        const matches: SearchMatch[] = [];
        const regex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');

        let match;
        while ((match = regex.exec(doc)) !== null) {
            matches.push({
                from: match.index,
                to: match.index + match[0].length,
            });
        }
        return matches;
    }

    function replaceAll(query: string, replacement: string, options: { caseSensitive?: boolean } = {}) {
        const matches = search(query, options);
        if (matches.length === 0) return;

        const changes = matches.map(match => ({
            from: match.from,
            to: match.to,
            insert: replacement,
        }));

        dispatch({ changes });
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
        search,
        replaceAll,
	}
}
