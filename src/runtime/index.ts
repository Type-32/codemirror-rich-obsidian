// Framework-free core: `@type32/codemirror-rich-obsidian-editor`. CodeMirror, Lezer, katex and yaml only; no Vue, no Nuxt
// (`test/boundary.test.ts` holds that). The Vue components are in `/vue`, the Nuxt module in `/nuxt`.

// The live preview, its parser config and the host's settings.
export { default as wysiwyg, markdownConfig } from './editor/wysiwyg'
export { internalLinkMapFacet } from './editor/plugins/linkMappingConfig'
export { specialCodeBlockMapFacet } from './editor/plugins/specialCodeBlockMappingConfig'
export { customBracketClosingConfig } from './editor/plugins/customBracketClosingConfig'
export { contextMenuSize, type MenuSize } from './editor/plugins/hostAppConfig'
export { editorKeywordSearchPlugin, searchOptionsFacet } from './editor/plugins/codemirror-editor-plugins/editorKeywordSearchPlugin'
export { propertiesPanel, panelEnd } from './editor/plugins/codemirror-plugin-proses/propertiesPlugin'
export { editorLabels, label } from './kit/labels'

// What draws tables, the properties panel and host components; nested editors (callouts, table cells).
export {
    componentMounter, propertiesRenderer, tableRenderer,
    type ComponentMounter, type Mounted, type PanelState, type RenderedTable, type Renderer,
} from './editor/plugins/renderers'
export { tableEntry } from './editor/plugins/codemirror-widgets/proseTableWidget'
export { nestedEditor, nestedExtensions, readOnly } from './editor/utility/nestedEditor'

// `[[` completion: the state and commands; a UI renders `linkSuggestionsIn(state)` (`/vue` has one).
export {
    closeLinkSuggest, linkQueryField, linkSuggestPlugin, linkSuggestionsIn, noteTargets, pickLinkSuggestion, selectLinkSuggestion,
    type LinkQuery,
} from './editor/plugins/codemirror-editor-plugins/linkSuggestPlugin'
export { linkSuggestions, type LinkSuggestion, type NoteTargets } from './editor/utility/linkSearch'

// Commands and queries for keymaps, menus and plugins.
export { blockInsertion, insertBlock, setLinePrefix, setLink, toggleMark, toggleWikilink } from './kit/commands'
export { MARKS, formattableRange, linkAt, markAt, wikilinkAt, type LinkInfo, type MarkType } from './kit/queries'
export { blockAt, canMoveBlock, deleteBlock, dropTarget, moveBlock, moveBlockTo, type Block, type Side } from './kit/blocks'
export { headingAt, headings, headingsField, headingsOf, type Heading } from './kit/headings'
export { mouseSelectingField, selectionTouches, selectionWithin } from './editor/utility/tools'
export { indentListItem, insertListContinuation, insertListNewline, listRenumbering, outdentListItem } from './editor/plugins/codemirror-editor-plugins/listEditingPlugin'

// Markdown, frontmatter and table text, without an editor.
export { parseMarkdownToAST } from './utils/markdownParser'
export { frontmatterRange, parseFrontmatter, parseYaml, stringifyYaml } from './utils/frontmatter'
export { convertValue, editProperties, inferType, propertiesYaml, removeProperty, renameProperty, setProperty } from './editor/utility/properties'
export {
    cellRange, deleteCol, deleteRow, escapeCell, insertCol, insertRow, moveCol, moveRow, newRow, parseTable, serializeTable, setAlign, setCell,
    type TableAlign, type TableModel,
} from './utils/markdownTable'

export type {
    EmbedMount, ExternalLinkClickDetail, Frontmatter, InternalLink, InternalLinkClickDetail, PropertiesOptions, PropertyType,
    SearchOptions, SpecialCodeBlockMapping, WysiwygPlugin,
} from './editor/types/editor-types'
