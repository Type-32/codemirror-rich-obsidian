/* COPYRIGHT NOTICE
* This code here belongs to https://github.com/erykwalder/lezer-markdown-obsidian, with a few modifications (lezer highlights
* and parsing logic) added by myself.
* */

import { type MarkdownConfig } from '@lezer/markdown';
import { Tag } from "@lezer/highlight";

export const lezerHighlightCallout = Tag.define();
export const lezerHighlightCalloutMark = Tag.define(lezerHighlightCallout);
export const lezerHighlightCalloutType = Tag.define(lezerHighlightCallout);
export const lezerHighlightCalloutFoldMark = Tag.define(lezerHighlightCallout);
export const lezerHighlightCalloutTitle = Tag.define(lezerHighlightCallout);

/**
 * `[!type|metadata]` + optional fold `+`/`-`, then a space, tab or line end (Obsidian rejects `[!note]Title`).
 * Groups: type, metadata (with its `|`), fold, title (rest of the line).
 */
const calloutRegex = /^\[!([^\]|\n]+)(\|[^\]\n]*)?\]([+-])?(?=[ \t\n]|$)(.*)/;

export const lezerCalloutParser: MarkdownConfig = {
    defineNodes: [
        { name: "Callout", style: lezerHighlightCallout },
        { name: "CalloutMark", style: lezerHighlightCalloutMark },
        { name: "CalloutType", style: lezerHighlightCalloutType },
        { name: "CalloutFoldMark", style: lezerHighlightCalloutFoldMark },
        { name: "CalloutTitle", style: lezerHighlightCalloutTitle },
    ],
    parseInline: [{
        name: "Callout",
        parse(cx, _next, pos) {
            // Only at the very start of a paragraph; `proseCalloutPlugin` further requires the blockquote's first line.
            if (pos !== cx.offset) return -1;
            const match = calloutRegex.exec(cx.slice(pos, cx.end));
            if (!match) return -1;

            const [whole, type, metadata = '', fold, title] = match;
            let at = pos;
            const children = [cx.elt("CalloutMark", at, at += 2)]; // "[!"
            children.push(cx.elt("CalloutType", at, at += type!.length));
            at += metadata.length;
            children.push(cx.elt("CalloutMark", at, at += 1)); // "]"
            if (fold) children.push(cx.elt("CalloutFoldMark", at, at += 1));
            const trimmed = title!.trim();
            if (trimmed) {
                const titleStart = at + title!.indexOf(trimmed);
                children.push(cx.elt("CalloutTitle", titleStart, titleStart + trimmed.length));
            }
            return cx.addElement(cx.elt("Callout", pos, pos + whole.length, children));
        },
        before: "Link"
    }]
};
