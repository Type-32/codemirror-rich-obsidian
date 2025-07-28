// this basically just puts all lezer parsers into one array of them, for ease of imports

import type {MarkdownConfig} from "@lezer/markdown";
import {lezerHashtagParser} from "~/editor/lezer-parsers/lezerHashtagParser";

export const OFM: MarkdownConfig[] = [
    lezerHashtagParser
]