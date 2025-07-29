import { ViewPlugin } from '@codemirror/view'
import { syntaxHighlighting } from '@codemirror/language';
import {markdown} from "@codemirror/lang-markdown";

import RichEditPlugin from "~/editor/plugins/richTextPlugin";
import proseStylesPlugin from "~/editor/plugins/lezerStylesHighlightingPlugin";
import {CustomOFM} from "~/editor/lezer-parsers/customOFMParsers";
import {proseHashtagCodemirrorViewPlugin} from "~/editor/plugins/codemirror-plugin-proses/proseHashtagCodemirrorViewPlugin";
import {
    proseInternalLinkCodemirrorViewPlugin
} from "~/editor/plugins/codemirror-plugin-proses/proseInternalLinkCodemirrorViewPlugin";
import {
    proseCodeBlockCodemirrorViewPlugin
} from "~/editor/plugins/codemirror-plugin-proses/proseCodeBlockCodemirrorViewPlugin";

export type WysiwygPlugin = {
    lezer?: any
}

export default function (config?: WysiwygPlugin) {
    const mergedConfig = {
        ...config?.lezer ?? [], // Spreads user-passed lezer config (like codeLanguages)
        extensions: [
            // GFM,
            CustomOFM,
            { remove: ["SetextHeading"] },
            ...(config?.lezer?.extensions ?? []) // Any other extensions passed in
        ],
        nested: { // For Markdoc tag parsing primarily
            blockquote: true,
            list: true,
        }
    };

    return ViewPlugin.fromClass(RichEditPlugin, {
        decorations: v => v.decorations,
        provide: value => [
            proseCodeBlockCodemirrorViewPlugin,
            proseInternalLinkCodemirrorViewPlugin,
            proseHashtagCodemirrorViewPlugin,
            syntaxHighlighting(proseStylesPlugin),
            markdown(mergedConfig)
        ]
    })
}