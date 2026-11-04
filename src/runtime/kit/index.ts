// Public authoring API: `@type32/codemirror-rich-obsidian-editor/kit`.
// Default extensions (`/ext`) are built only on what this file exports.
export { mountVueComponent } from './vue'
export { vueOverlay, type EditorContext } from './overlay'
export { builtinActions, resolveActions, type ActionEntry, type EditorAction } from './actions'
export { setLink, toggleMark, toggleWikilink } from './commands'
export { MARKS, formattableRange, linkAt, markAt, wikilinkAt, type LinkInfo, type MarkType } from './queries'
export { mouseSelectingField, selectionTouches, selectionWithin } from '../editor/utility/tools'
