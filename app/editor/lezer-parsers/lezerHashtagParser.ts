/* COPYRIGHT NOTICE
* This code here belongs to https://github.com/erykwalder/lezer-markdown-obsidian, with a few modifications (lezer highlights)
* added by myself.
* */

import {InlineContext, type MarkdownConfig} from "@lezer/markdown";
import { Tag, tags as t } from '@lezer/highlight';

const hashtagRE =
    /^[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~\[\]\\\s]+/;

export const lezerHighlightHashtag = Tag.define();
export const lezerHighlightHashtagMark = Tag.define(lezerHighlightHashtag);
export const lezerHighlightHashtagLabel = Tag.define(lezerHighlightHashtag);

export const lezerHashtagParser: MarkdownConfig = {
    defineNodes: [
        { name: "Hashtag", style: lezerHighlightHashtag },
        "HashtagMark",
        "HashtagLabel"
    ],
    parseInline: [
        {
            name: "Hashtag",
            parse(cx: InlineContext, next: number, pos: number) {
                if (next != 35 /* # */) {
                    return -1;
                }
                const start = pos;
                pos += 1;
                const match = hashtagRE.exec(cx.text.slice(pos - cx.offset));
                if (match && /\D/.test(match[0])) {
                    pos += match[0].length;
                    return cx.addElement(
                        cx.elt("Hashtag", start, pos, [
                            cx.elt("HashtagMark", start, start + 1),
                            cx.elt("HashtagLabel", start + 1, pos),
                        ])
                    );
                }
                return -1;
            },
        },
    ],
};