import { type MarkdownConfig } from '@lezer/markdown';
import { Tag } from "@lezer/highlight";

export const lezerHighlightCallout = Tag.define();
export const lezerHighlightCalloutMark = Tag.define(lezerHighlightCallout);
export const lezerHighlightCalloutType = Tag.define(lezerHighlightCallout);
export const lezerHighlightCalloutFoldMark = Tag.define(lezerHighlightCallout);
export const lezerHighlightCalloutTitle = Tag.define(lezerHighlightCallout);

const calloutRegex = /^\[!(?<type>[^\]]+)\](?<fold>[+-])?(?<title>.*)/;

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
        parse(cx, next, pos) {
            const text = cx.slice(pos, cx.end);
            const match = calloutRegex.exec(text);

            if (!match || !match.groups) {
                return -1;
            }

            const { type, fold, title } = match.groups;
            if (!type) {
                return -1;
            }

            const fullMatchLength = match[0].length;
            const children = [];
            let currentPosInMatch = 0;

            // Mark for "[!"
            children.push(cx.elt("CalloutMark", pos + currentPosInMatch, pos + currentPosInMatch + 2));
            currentPosInMatch += 2;

            // Type
            children.push(cx.elt("CalloutType", pos + currentPosInMatch, pos + currentPosInMatch + type.length));
            currentPosInMatch += type.length;

            // Mark for "]"
            children.push(cx.elt("CalloutMark", pos + currentPosInMatch, pos + currentPosInMatch + 1));
            currentPosInMatch += 1;

            // Fold
            if (fold) {
                children.push(cx.elt("CalloutFoldMark", pos + currentPosInMatch, pos + currentPosInMatch + 1));
                currentPosInMatch += 1;
            }

            // Title
            if (title) {
                const trimmedTitle = title.trim();
                if (trimmedTitle.length > 0) {
                    const titleStartOffset = title.indexOf(trimmedTitle);
                    const titleStart = pos + currentPosInMatch + titleStartOffset;
                    children.push(cx.elt("CalloutTitle", titleStart, titleStart + trimmedTitle.length));
                }
            }

            return cx.addElement(cx.elt("Callout", pos, pos + fullMatchLength, children));
        },
        before: "Link"
    }]
};
