import { ViewPlugin } from '@codemirror/view'
import { syntaxHighlighting } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'

import RichEditPlugin from './plugins/richTextPlugin'
import proseStylesPlugin from './plugins/lezerStylesHighlightingPlugin'
import { CustomOFM } from './lezer-parsers/customOFMParsers'
import { proseHashtagCodemirrorViewPlugin } from './plugins/codemirror-plugin-proses/proseHashtagCodemirrorViewPlugin'
import {
  proseInternalLinkCodemirrorViewPlugin,
} from './plugins/codemirror-plugin-proses/proseInternalLinkCodemirrorViewPlugin'
import {
  proseCodeBlockCodemirrorViewPlugin,
} from './plugins/codemirror-plugin-proses/proseCodeBlockCodemirrorViewPlugin'
import { editorLinkClickPlugin } from './plugins/codemirror-editor-plugins/editorLinkClickPlugin'
import { proseLinkCodemirrorViewPlugin } from './plugins/codemirror-plugin-proses/proseLinkCodemirrorViewPlugin'
import { GFM } from '@lezer/markdown'
import { proseLatexCodemirrorViewPlugin } from './plugins/codemirror-plugin-proses/proseLatexCodemirrorViewPlugin'
import {
  editorInternalLinkAutocompletePlugin,
} from './plugins/codemirror-editor-plugins/editorInternalLinkAutocompletePlugin'
import {
  proseQuoteblockCodemirrorViewPlugin,
} from './plugins/codemirror-plugin-proses/proseQuoteblockCodemirrorViewPlugin'
import { editorKeymapPlugin } from './plugins/codemirror-editor-plugins/editorKeymapPlugin'
import {
  proseHighlightCodemirrorViewPlugin,
} from './plugins/codemirror-plugin-proses/proseHighlightCodemirrorViewPlugin'
import { autocompletion, closeBrackets } from '@codemirror/autocomplete'
import { customBracketClosingPlugin } from './plugins/codemirror-editor-plugins/customBracketClosingPlugin'
import { customBracketClosingConfig } from './plugins/customBracketClosingConfig'
import { editorAttributesPlugin } from './plugins/codemirror-editor-plugins/editorAttributesPlugin'
import { indentationGuides } from './plugins/codemirror-editor-plugins/indentationGuidesPlugin'
import { editorLivePreviewField, proseTaskListPlugin } from './plugins/codemirror-plugin-proses/proseTaskListPlugin'
import { proseCalloutPlugin } from './plugins/codemirror-plugin-proses/proseCalloutPlugin'
import { indentationListPlugin } from './plugins/codemirror-editor-plugins/indentationListPlugin'
import type { WysiwygPlugin } from './types/editor-types'

export default function (config?: WysiwygPlugin) {
    const { codeLanguages, ...lezerRest } = config?.lezer ?? {}

    const mergedConfig = {
        ...(lezerRest ?? []),
        codeLanguages: codeLanguages,
        extensions: [
            GFM,
            CustomOFM,
            { remove: ['SetextHeading'] },
            ...(config?.lezer?.extensions ?? []), // Any other extensions passed in
        ],
        nested: {
            // For Markdoc tag parsing primarily
            blockquote: true,
            list: true,
        },
    }

    return ViewPlugin.fromClass(RichEditPlugin, {
        decorations: (v) => v.decorations,
        provide: (value) => [
            autocompletion(),
            closeBrackets(),
            proseCodeBlockCodemirrorViewPlugin,
            proseHighlightCodemirrorViewPlugin,
            proseInternalLinkCodemirrorViewPlugin,
            proseLinkCodemirrorViewPlugin,
            proseHashtagCodemirrorViewPlugin,
            proseLatexCodemirrorViewPlugin(),
            proseQuoteblockCodemirrorViewPlugin,
            proseCalloutPlugin,
            proseTaskListPlugin,

            editorLivePreviewField.init(() => true),
            editorLinkClickPlugin,
            editorInternalLinkAutocompletePlugin,
            editorKeymapPlugin,
            customBracketClosingPlugin,
            customBracketClosingConfig.of(true), // Default to enabled
            indentationGuides(),
            indentationListPlugin,
            // editorAttributesPlugin,
            syntaxHighlighting(proseStylesPlugin),
			//@ts-ignore
            markdown(mergedConfig),
        ],
    })
}
