import { ViewPlugin } from '@codemirror/view'
import { syntaxHighlighting } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'

import RichEditPlugin from '~/editor/plugins/richTextPlugin'
import proseStylesPlugin from '~/editor/plugins/lezerStylesHighlightingPlugin'
import { CustomOFM } from '~/editor/lezer-parsers/customOFMParsers'
import { proseHashtagCodemirrorViewPlugin } from '~/editor/plugins/codemirror-plugin-proses/proseHashtagCodemirrorViewPlugin'
import { proseInternalLinkCodemirrorViewPlugin } from '~/editor/plugins/codemirror-plugin-proses/proseInternalLinkCodemirrorViewPlugin'
import { proseCodeBlockCodemirrorViewPlugin } from '~/editor/plugins/codemirror-plugin-proses/proseCodeBlockCodemirrorViewPlugin'
import { editorLinkClickPlugin } from '~/editor/plugins/codemirror-editor-plugins/editorLinkClickPlugin'
import { proseLinkCodemirrorViewPlugin } from '~/editor/plugins/codemirror-plugin-proses/proseLinkCodemirrorViewPlugin'
import { GFM } from '@lezer/markdown'
import { proseLatexCodemirrorViewPlugin } from '~/editor/plugins/codemirror-plugin-proses/proseLatexCodemirrorViewPlugin'
import { editorInternalLinkAutocompletePlugin } from '~/editor/plugins/codemirror-editor-plugins/editorInternalLinkAutocompletePlugin'
import { proseQuoteblockCodemirrorViewPlugin } from '~/editor/plugins/codemirror-plugin-proses/proseQuoteblockCodemirrorViewPlugin'
import editor from '~/components/Editor.vue'
import { editorKeymapPlugin } from '~/editor/plugins/codemirror-editor-plugins/editorKeymapPlugin'
import { proseHighlightCodemirrorViewPlugin } from '~/editor/plugins/codemirror-plugin-proses/proseHighlightCodemirrorViewPlugin'
import { closeBrackets, autocompletion } from '@codemirror/autocomplete'
import { customBracketClosingPlugin } from '~/editor/plugins/codemirror-editor-plugins/customBracketClosingPlugin'
import { customBracketClosingConfig } from '~/editor/plugins/customBracketClosingConfig'
import { editorAttributesPlugin } from '~/editor/plugins/codemirror-editor-plugins/editorAttributesPlugin'
import { basicSetup } from 'codemirror'
import { indentationGuides } from '~/editor/plugins/codemirror-editor-plugins/indentationGuidesPlugin'
import {
    proseTaskListPlugin,
    editorLivePreviewField,
} from '~/editor/plugins/codemirror-plugin-proses/proseTaskListPlugin'

export type WysiwygPlugin = {
    lezer?: any
}

export default function (config?: WysiwygPlugin) {
    const mergedConfig = {
        ...(config?.lezer ?? []), // Spreads user-passed lezer config (like codeLanguages)
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
            customBracketClosingPlugin,
            customBracketClosingConfig.of(true), // Default to enabled
            proseCodeBlockCodemirrorViewPlugin,
            proseHighlightCodemirrorViewPlugin,
            proseInternalLinkCodemirrorViewPlugin,
            proseLinkCodemirrorViewPlugin,
            proseHashtagCodemirrorViewPlugin,
            proseLatexCodemirrorViewPlugin(),
            proseQuoteblockCodemirrorViewPlugin,
            proseTaskListPlugin,
            editorLivePreviewField.init(() => true),

            editorLinkClickPlugin,
            editorInternalLinkAutocompletePlugin,
            editorKeymapPlugin,
            indentationGuides(),
            // editorAttributesPlugin,
            syntaxHighlighting(proseStylesPlugin),
            markdown(mergedConfig),
        ],
    })
}
