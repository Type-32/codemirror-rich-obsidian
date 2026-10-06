import { markdown } from '@codemirror/lang-markdown'
import type { Tree } from '@lezer/common'
import { markdownConfig } from '../editor/wysiwyg'

// Built once: same extension set the live editor uses, so offline ASTs match on-screen parsing.
//@ts-ignore lezer extension typing is looser than lang-markdown's
const parser = markdown(markdownConfig()).language.parser

/** Parses markdown text to a Lezer tree with the editor's OFM configuration. */
export function parseMarkdownToAST(markdownText: string): Tree {
	return parser.parse(markdownText)
}
