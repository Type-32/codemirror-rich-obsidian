import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import { StateField, RangeSet, type Transaction } from '@codemirror/state'
import type { EditorState, Range as EditorRange } from '@codemirror/state'

/**
 * Configuration options for creating a prose plugin
 */
export interface ProsePluginConfig {
	/**
	 * Function to build decorations from the editor state
	 */
	buildDecorations: (state: EditorState) => EditorRange<Decoration>[]
	
	/**
	 * Whether to rebuild decorations on document changes (default: true)
	 */
	rebuildOnDocChange?: boolean
	
	/**
	 * Whether to rebuild decorations on selection changes (default: false)
	 */
	rebuildOnSelection?: boolean
	
	/**
	 * Whether to sort the decorations (default: true)
	 */
	sortDecorations?: boolean
}

/**
 * Creates a CodeMirror StateField plugin for prose decorations with the standard pattern.
 * This reduces boilerplate for simple prose plugins that follow the common pattern:
 * - Build decorations from syntax tree
 * - Update on document/selection changes
 * - Provide decorations to editor view
 * 
 * @param config Configuration object for the plugin
 * @returns A CodeMirror StateField that can be added to the editor
 * 
 * @example
 * ```ts
 * export const myPlugin = createProsePlugin({
 *   buildDecorations: (state) => {
 *     const decorations: EditorRange<Decoration>[] = []
 *     syntaxTree(state).iterate({
 *       enter(node) {
 *         if (node.name === 'MyNode') {
 *           decorations.push(myDecoration.range(node.from, node.to))
 *         }
 *       }
 *     })
 *     return decorations
 *   },
 *   rebuildOnSelection: true
 * })
 * ```
 */
export function createProsePlugin(config: ProsePluginConfig): StateField<DecorationSet> {
	const {
		buildDecorations,
		rebuildOnDocChange = true,
		rebuildOnSelection = false,
		sortDecorations = true,
	} = config

	return StateField.define<DecorationSet>({
		create(state: EditorState) {
			return RangeSet.of(buildDecorations(state), sortDecorations)
		},
		update(value: DecorationSet, tr: Transaction) {
			const shouldRebuild = 
				(rebuildOnDocChange && tr.docChanged) ||
				(rebuildOnSelection && tr.selection)
			
			if (shouldRebuild) {
				return RangeSet.of(buildDecorations(tr.state), sortDecorations)
			}
			return value.map(tr.changes)
		},
		provide: (f) => EditorView.decorations.from(f),
	})
}

