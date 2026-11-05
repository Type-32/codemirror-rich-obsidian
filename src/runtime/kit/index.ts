// Public authoring API: `@type32/codemirror-rich-obsidian-editor/kit`.
// Default extensions (`/ext`) are built only on what this file exports.
export { mountVueComponent } from './vue'
export { floatingContent, keepEditorFocus, virtualAnchor, vueOverlay, type EditorContext } from './overlay'
export { builtinActions, defineItemsFacet, filterActions, resolveActions, type ActionEntry, type ActionItems, type EditorAction } from './actions'
export { editorLabels, label } from './labels'
export { blockInsertion, insertBlock, setLinePrefix, setLink, toggleMark, toggleWikilink } from './commands'
export { MARKS, formattableRange, linkAt, markAt, wikilinkAt, type LinkInfo, type MarkType } from './queries'
export { blockAt, canMoveBlock, deleteBlock, dropTarget, moveBlock, moveBlockTo, type Block, type Side } from './blocks'
export { headingAt, headings, headingsField, headingsOf, type Heading } from './headings'
export { default as ActionList } from './components/ActionList.vue'
export { mouseSelectingField, selectionTouches, selectionWithin } from '../editor/utility/tools'
