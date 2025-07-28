// this basically just puts all lezer parsers into one array of them, for ease of imports

import {Strikethrough, Table} from "@lezer/markdown";
import {lezerHashtagParser} from "~/editor/lezer-parsers/lezerHashtagParser";
import {InternalLink, Mark, Comment, Footnote, TaskList, Tex, YAMLFrontMatter} from "lezer-markdown-obsidian";

export const CustomOFM = [ // the array here must remain implicit because the version of @lezer/markdown that lezer-markdown-obsidian uses is different than the one this project is using.
    Comment,
    Footnote,
    lezerHashtagParser,
    InternalLink,
    Mark,
    Strikethrough,
    Table,
    TaskList,
    Tex,
    YAMLFrontMatter
]