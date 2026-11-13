import { syntaxHighlighting } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { GFM } from '@lezer/markdown'
import { styleTags, tags as t } from '@lezer/highlight'
import { autocompletion, closeBrackets } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'

import { richTextPlugin } from './plugins/richTextPlugin'
import proseStylesPlugin from './plugins/lezerStylesHighlightingPlugin'
import { codeHighlighter } from './plugins/codeHighlighter'
import { CustomOFM } from './lezer-parsers/customOFMParsers'
import { mouseSelectingTracker } from './utility/tools'
import { proseHashtagPlugin } from './plugins/codemirror-plugin-proses/proseHashtagCodemirrorViewPlugin'
import { proseInternalLinkPlugin } from './plugins/codemirror-plugin-proses/proseInternalLinkCodemirrorViewPlugin'
import { proseCodeBlockPlugin } from './plugins/codemirror-plugin-proses/proseCodeBlockCodemirrorViewPlugin'
import { proseLinkPlugin } from './plugins/codemirror-plugin-proses/proseLinkCodemirrorViewPlugin'
import { proseLatexPlugin } from './plugins/codemirror-plugin-proses/proseLatexCodemirrorViewPlugin'
import { proseQuoteblockPlugin } from './plugins/codemirror-plugin-proses/proseQuoteblockCodemirrorViewPlugin'
import { proseHighlightPlugin } from './plugins/codemirror-plugin-proses/proseHighlightCodemirrorViewPlugin'
import { proseTaskListPlugin } from './plugins/codemirror-plugin-proses/proseTaskListPlugin'
import { proseCalloutPlugin } from './plugins/codemirror-plugin-proses/proseCalloutPlugin'
import { proseTablePlugin } from './plugins/codemirror-plugin-proses/proseTablePlugin'
import { proseListPlugin, proseListEditMarkPlugin } from './plugins/codemirror-plugin-proses/proseListPlugin'
import { proseHangingIndentPlugin } from './plugins/codemirror-plugin-proses/proseHangingIndentPlugin'
import { editorLinkClickPlugin } from './plugins/codemirror-editor-plugins/editorLinkClickPlugin'
import { editorInternalLinkAutocompletePlugin } from './plugins/codemirror-editor-plugins/editorInternalLinkAutocompletePlugin'
import { editorKeymapPlugin } from './plugins/codemirror-editor-plugins/editorKeymapPlugin'
import { customBracketClosingPlugin } from './plugins/codemirror-editor-plugins/customBracketClosingPlugin'
import { customBracketClosingConfig } from './plugins/customBracketClosingConfig'
import { indentationGuides } from './plugins/codemirror-editor-plugins/indentationGuidesPlugin'
import { listEditing } from './plugins/codemirror-editor-plugins/listEditingPlugin'
import type { WysiwygPlugin } from './types/editor-types'

/**
 * Style overrides on top of lezer-markdown's: fenced code text carries the code language's own tokens (not the
 * inline-code `monospace` pill), and a revealed fence's language and a `[ ]` task marker are formatting like Obsidian's.
 */
const obsidianStyleTags = { props: [styleTags({ 'FencedCode/CodeText': t.content, 'FencedCode/CodeInfo': t.meta, 'Task/TaskMarker': t.meta })] }

/** Lezer config shared with `parseMarkdownToAST` so offline parsing matches the live editor. */
export function markdownConfig(config?: WysiwygPlugin['lezer']) {
    const { extensions, ...rest } = config ?? {}
    return {
        ...rest,
        extensions: [GFM, CustomOFM, obsidianStyleTags, { remove: ['SetextHeading'] }, ...(extensions ?? [])],
    }
}

export default function (config?: WysiwygPlugin): Extension {
    return [
        autocompletion(),
        closeBrackets(),
        mouseSelectingTracker,
        richTextPlugin,
        proseCodeBlockPlugin,
        proseHighlightPlugin,
        proseInternalLinkPlugin,
        proseLinkPlugin,
        proseHashtagPlugin,
        proseLatexPlugin,
        proseQuoteblockPlugin,
        proseCalloutPlugin,
        proseTablePlugin,
        proseTaskListPlugin,
        proseListPlugin,
        proseListEditMarkPlugin,
        proseHangingIndentPlugin,

        editorLinkClickPlugin,
        editorInternalLinkAutocompletePlugin,
        editorKeymapPlugin,
        listEditing,
        customBracketClosingPlugin,
        customBracketClosingConfig.of(true),
        indentationGuides(),
        syntaxHighlighting(proseStylesPlugin),
        syntaxHighlighting(codeHighlighter),
        //@ts-ignore lezer extension typing is looser than lang-markdown's
        markdown({ ...markdownConfig({ ...config?.lezer, codeLanguages: config?.lezer?.codeLanguages ?? languages }), addKeymap: false }),
    ]
}
