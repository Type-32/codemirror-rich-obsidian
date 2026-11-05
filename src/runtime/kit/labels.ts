import { Facet, type EditorState } from '@codemirror/state'

/**
 * Replacement text for the editor's built-in UI, keyed by action id (`bold`, `heading1`, AI preset
 * ids, `askAi`, `moveUp`…) or `ui.*` string key. Values merge per key; like `aiOptions`, the first
 * (highest-precedence) value wins. Missing keys keep the English default.
 *
 * ```ts
 * editorLabels.of({ bold: '粗体', 'ui.ai.accept': '接受' })
 * ```
 */
export const editorLabels = Facet.define<Record<string, string>, Record<string, string>>({
    combine: values => Object.assign(Object.create(null), ...[...values].reverse()),
})

/** The configured label for `key`, or `fallback`. */
export function label(state: EditorState, key: string, fallback: string): string {
    return state.facet(editorLabels)[key] ?? fallback
}
