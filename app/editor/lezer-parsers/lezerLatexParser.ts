import type { MarkdownConfig, BlockContext, InlineContext, Line } from '@lezer/markdown';
import {Tag} from "@lezer/highlight";

const TexDelim = { resolve: "TexInline", mark: "TexMarker" };

export const lezerHighlightLatex = Tag.define('Tex'); // For generic TeX styling
export const lezerHighlightLatexBlock = Tag.define('TexBlock');
export const lezerHighlightLatexInline = Tag.define('TexInline');
export const lezerHighlightLatexMarker = Tag.define('TexMarker');

export const lezerLatexParser: MarkdownConfig = {
    defineNodes: [
        {name: "Tex", style: lezerHighlightLatex},
        {name: "TexBlock", style: lezerHighlightLatexBlock},
        {name: "TexInline", style: lezerHighlightLatexInline},
        {name: "TexMarker", style: lezerHighlightLatexMarker}
    ],
    parseBlock: [
        {
            name: "TexBlock",
            endLeaf: (_, line: Line) =>
                line.text.slice(line.pos, line.pos + 2) == "$$", // Check for "$$" at line start
            parse(cx: BlockContext, line: Line) {
                if (line.text.slice(line.pos, line.pos + 2) != "$$") {
                    return false;
                }
                const start = cx.lineStart + line.pos;
                const markers = [cx.elt("TexMarker", start, start + 2)]; // Opening "$$"
                const regex = /(^|[^\\])\$\$/; // Match non-escaped "$$"
                let remaining = line.text.slice(line.pos + 2);
                let startOffset = 2;
                let match;

                // Search for closing "$$"
                while (!(match = regex.exec(remaining)) && cx.nextLine()) {
                    remaining = line.text; // Full line text
                    startOffset = 0;
                }

                let end;
                if (match) {
                    const lineEnd = match.index + match[0].length + startOffset;
                    end = cx.lineStart + lineEnd;
                    markers.push(cx.elt("TexMarker", end - 2, end)); // Closing "$$"

                    // Consume the line if "$$" is at the end or followed by whitespace
                    if (
                        lineEnd == line.text.length ||
                        /^\s*$/.test(line.text.slice(lineEnd))
                    ) {
                        cx.nextLine();
                    } else {
                        // If there's content after "$$" on the same line, adjust line.pos
                        line.pos = line.skipSpace(lineEnd);
                    }
                } else {
                    // No closing "$$", consume to end of document (or handle as unterminated)
                    end = cx.lineStart + line.text.length; // Or cx.docLen if it should span till end
                }
                // The content between markers is not explicitly parsed here but implied
                cx.addElement(cx.elt("TexBlock", start, end, markers));
                return true;
            },
            before: "FencedCode" // Run before fenced code blocks
        },
    ],
    parseInline: [
        {
            name: "TexInline",
            parse(cx: InlineContext, next: number, pos: number) {
                if (next != 36 /* $ */) { // Dollar sign
                    return -1;
                }
                // Check if the next char is also '$', if so, defer to block parser
                if (cx.char(pos + 1) == 36) return -1;

                // Rules for valid opening/closing $ for inline math (pandoc style)
                const before = cx.slice(pos - 1, pos);
                const after = cx.slice(pos + 1, pos + 2);

                // Can open if char after $ is not whitespace and not a digit (unless char before $ is non-space)
                // Can close if char before $ is not whitespace and char after $ is not a digit (unless ... complex)
                // Simplified: must not be surrounded by spaces, or must have non-space content
                let canOpen = !/\s/.test(after) && after !== '$';
                let canClose = !/\s/.test(before) && before !== '$';

                if (cx.char(pos-1) === 32 && cx.char(pos+1)===32) { //
                    canOpen = false;
                    canClose = false;
                }

                return cx.addDelimiter(TexDelim, pos, pos + 1, canOpen, canClose);
            },
            before: "Emphasis" // Or "Escape"
        },
    ],
};
