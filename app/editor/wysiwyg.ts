import { ViewPlugin } from '@codemirror/view'
import { syntaxHighlighting } from '@codemirror/language';
import {markdown} from "@codemirror/lang-markdown";

import RichEditPlugin from "~/editor/plugins/richTextPlugin";
import proseStylesPlugin from "~/editor/plugins/proseStylesPlugin";
import {GFM} from "@lezer/markdown";
import {Extensions as OFM} from "lezer-markdown-obsidian"
import {languages} from "@codemirror/language-data";

export type WysiwygPlugin = {
    lezer?: any
}

export default function (config?: WysiwygPlugin) {
    const mergedConfig = {
        ...config?.lezer ?? {
            codeLanguages: languages,
        }, // Spreads user-passed lezer config (like codeLanguages)
        extensions: [
            GFM,
            OFM,
            { remove: ["SetextHeading"] },
            ...(config?.lezer?.extensions ?? []) // Any other extensions passed in
        ],
        nested: { // For Markdoc tag parsing primarily
            blockquote: true,
            list: true,
        }
    };

    return ViewPlugin.fromClass(RichEditPlugin, {
        decorations: value => value.decorations,
        provide: value => [
            syntaxHighlighting(proseStylesPlugin),
            markdown(mergedConfig)
        ]
    })
}