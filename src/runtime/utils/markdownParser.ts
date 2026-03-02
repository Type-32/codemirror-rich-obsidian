import { markdown } from '@codemirror/lang-markdown'
import { GFM, type MarkdownExtension } from '@lezer/markdown'
import { CustomOFM } from '../editor/lezer-parsers/customOFMParsers'
import type { LanguageSupport } from '@codemirror/language'
import type { Tree } from '@lezer/common'

/**
 * Creates a markdown parser with standard OFM extensions
 * This configuration is used consistently across the codebase
 */
export function createMarkdownParser(): LanguageSupport {
	return markdown({
		extensions: [GFM, CustomOFM as MarkdownExtension[], { remove: ['SetextHeading'] }],
	})
}

/**
 * Parses markdown text to AST using the standard OFM parser configuration
 * @param markdownText The markdown text to parse
 * @returns The parsed syntax tree
 */
export function parseMarkdownToAST(markdownText: string): Tree {
	return createMarkdownParser().language.parser.parse(markdownText)
}

