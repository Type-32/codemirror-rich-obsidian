/* COPYRIGHT NOTICE
* This code here belongs to https://github.com/erykwalder/lezer-markdown-obsidian, with a few modifications (lezer highlights
* and parsing logic) added by myself.
* */

import type { Input } from "@lezer/common"; // Added import
import type { MarkdownConfig, BlockContext, Line } from '@lezer/markdown';
import {Tag} from "@lezer/highlight";

export const lezerHighlightYamlFrontmatter = Tag.define('YAMLFrontMatter'); // The entire block highlight
export const lezerHighlightYamlMarker = Tag.define('YAMLMarker', lezerHighlightYamlFrontmatter); // The marker: "---"
export const lezerHighlightYamlContent = Tag.define('YAMLContent', lezerHighlightYamlFrontmatter); // the content inbetween the yaml markers. This part will be parsed by a specialized yaml parser later for more logic and stuff.

declare module "@lezer/markdown" {
    interface BlockContext {
        readonly input: Input;
        // @ts-ignore
        checkedYaml?: boolean | null;
    }
}

export const lezerYamlFrontmatterParser: MarkdownConfig = {
    defineNodes: [
        {name: "YAMLFrontMatter", style: lezerHighlightYamlFrontmatter},
        {name: "YAMLMarker", style: lezerHighlightYamlMarker},
        {name: "YAMLContent", style: lezerHighlightYamlContent}
    ],
    parseBlock: [
        {
            name: "YAMLFrontMatter",
            parse(cx: BlockContext, line: Line) {
                // Ensure checkedYaml exists on cx
                if (!Object.prototype.hasOwnProperty.call(cx, 'checkedYaml')) {
                    (cx as any).checkedYaml = null; // Initialize if not present
                }

                if (cx.checkedYaml || cx.lineStart !== 0) { // Only parse at the very beginning of the doc
                    return false;
                }
                cx.checkedYaml = true; // Mark as checked for this parse run

                // Check for opening '---'
                if (line.text.slice(line.pos) !== "---") {
                    return false;
                }

                const start = cx.lineStart + line.pos; // Start of opening '---'
                const markers: any[] = [cx.elt("YAMLMarker", start, start + 3)];
                let contentStart = -1;
                let contentEnd = -1;
                let end = -1;

                // Read lines until closing '---' or '...'
                while (cx.nextLine()) {
                    if (contentStart === -1) contentStart = cx.lineStart; // First line after opening '---'

                    const lineText = line.text.slice(line.pos);
                    if (lineText === "---" || lineText === "...") {
                        contentEnd = cx.lineStart -1; // Previous line end
                        if (contentStart > contentEnd && contentStart !== -1) contentEnd = contentStart; // Handle empty content

                        end = cx.lineStart + line.pos + 3; // End of closing '---' or '...'
                        markers.push(cx.elt("YAMLMarker", cx.lineStart + line.pos, end));
                        cx.nextLine(); // Consume the closing marker line
                        break;
                    }
                }

                if (end === -1) return false; // No closing marker found

                if (contentStart !== -1 && contentEnd !== -1 && contentStart <= contentEnd) {
                    markers.splice(1, 0, cx.elt("YAMLContent", contentStart, contentEnd));
                } else if (contentStart !== -1 && contentEnd === -1) { // If file ends before closing marker
                    // @ts-ignore
                    contentEnd = cx.docLen; // parse till end of document
                    markers.splice(1, 0, cx.elt("YAMLContent", contentStart, contentEnd));
                }


                cx.addElement(cx.elt("YAMLFrontMatter", start, end, markers));
                return true;
            },
            before: "LinkReference",
        },
    ],
};
