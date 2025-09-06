/* COPYRIGHT NOTICE
* This code here belongs to https://github.com/erykwalder/lezer-markdown-obsidian, with a few modifications (lezer highlights)
* added by myself.
* */

import {InlineContext, type MarkdownConfig} from "@lezer/markdown";
import { Tag } from '@lezer/highlight';

const hashtagRE =
    /^[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~\[\]\\\s]+/;

export const lezerHighlightHashtagTag = Tag.define('HashtagTag');
export const lezerHighlightHashtagTagMark = Tag.define('HashtagTagMark', lezerHighlightHashtagTag);
export const lezerHighlightHashtagTagLabel = Tag.define('HashtagTagLabel', lezerHighlightHashtagTag);

export const lezerHashtagParser: MarkdownConfig = {
    defineNodes: [
        { name: "HashtagTag", style: lezerHighlightHashtagTag },
        { name: "HashtagTagMark", style: lezerHighlightHashtagTagMark },
        { name: "HashtagTagLabel", style: lezerHighlightHashtagTagLabel }
    ],
    parseInline: [
        {
            name: "HashtagTag",
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
                        cx.elt("HashtagTag", start, pos, [
                            cx.elt("HashtagTagMark", start, start + 1),
                            cx.elt("HashtagTagLabel", start + 1, pos),
                        ])
                    );
                }
                return -1;
            },
        },
    ],
};