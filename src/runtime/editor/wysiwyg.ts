import { syntaxHighlighting } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import { autocompletion, closeBrackets } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'

import { richTextPlugin } from './plugins/richTextPlugin'
import proseStylesPlugin from './plugins/lezerStylesHighlightingPlugin'
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
import { proseListPlugin, proseListEditMarkPlugin, proseListActiveGuidePlugin } from './plugins/codemirror-plugin-proses/proseListPlugin'
import { editorLinkClickPlugin } from './plugins/codemirror-editor-plugins/editorLinkClickPlugin'
import { editorInternalLinkAutocompletePlugin } from './plugins/codemirror-editor-plugins/editorInternalLinkAutocompletePlugin'
import { editorKeymapPlugin } from './plugins/codemirror-editor-plugins/editorKeymapPlugin'
import { customBracketClosingPlugin } from './plugins/codemirror-editor-plugins/customBracketClosingPlugin'
import { customBracketClosingConfig } from './plugins/customBracketClosingConfig'
import { indentationGuides } from './plugins/codemirror-editor-plugins/indentationGuidesPlugin'
import type { WysiwygPlugin } from './types/editor-types'

/** Lezer config shared with `parseMarkdownToAST` so offline parsing matches the live editor. */
export function markdownConfig(config?: WysiwygPlugin['lezer']) {
    const { codeLanguages, extensions, ...rest } = config ?? {}
    return {
        ...rest,
        codeLanguages,
        extensions: [GFM, CustomOFM, { remove: ['SetextHeading'] }, ...(extensions ?? [])],
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
        proseListActiveGuidePlugin,

        editorLinkClickPlugin,
        editorInternalLinkAutocompletePlugin,
        editorKeymapPlugin,
        customBracketClosingPlugin,
        customBracketClosingConfig.of(true),
        indentationGuides(),
        syntaxHighlighting(proseStylesPlugin),
        //@ts-ignore lezer extension typing is looser than lang-markdown's
        markdown(markdownConfig(config?.lezer)),
    ]
}
