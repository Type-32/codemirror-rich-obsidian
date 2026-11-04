// Stand-in for `/ext/ai/tools` when `ai` isn't installed: no tools, one warning.
console.warn('[codemirror-rich-obsidian-editor] editorTools is empty: install the optional peer dependency `ai` to enable it.')

export const editorTools = {}

export type EditorToolName = never
