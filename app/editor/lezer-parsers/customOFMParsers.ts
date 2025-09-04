// this basically just puts all lezer parsers into one array of them, for ease of imports

import {Strikethrough, Table} from "@lezer/markdown";
import {lezerHashtagParser} from "~/editor/lezer-parsers/lezerHashtagParser";
import {InternalLink, Mark, Comment, Footnote, TaskList, Tex} from "lezer-markdown-obsidian";
import {lezerYamlFrontmatterParser} from "~/editor/lezer-parsers/lezerYamlFrontmatterParser";
import {lezerInternalLinkParser} from "~/editor/lezer-parsers/lezerInternalLinkParser";
import {lezerLatexParser} from "~/editor/lezer-parsers/lezerLatexParser";
import { lezerCalloutParser } from '~/editor/lezer-parsers/lezerCalloutParser'
import {lezerIndentationParser} from "~/editor/lezer-parsers/lezerIndentationParser";

export const CustomOFM = [ // the array here must remain implicit because the version of @lezer/markdown that lezer-markdown-obsidian uses is different than the one this project is using.
    Comment,
    Footnote,
    lezerHashtagParser,
    lezerInternalLinkParser,
    Mark,
    Strikethrough,
    Table,
    TaskList,
    lezerLatexParser,
    lezerYamlFrontmatterParser,
    lezerCalloutParser,
    lezerIndentationParser,
]