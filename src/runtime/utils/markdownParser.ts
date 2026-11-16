import { markdown } from '@codemirror/lang-markdown'
import type { Parser, Tree } from '@lezer/common'
import { markdownConfig } from '../editor/wysiwyg'
import type { MarkdownOptions } from '../editor/types/editor-types'

const parser = (options?: MarkdownOptions): Parser =>
    //@ts-ignore lezer extension typing is looser than lang-markdown's
    markdown(markdownConfig(options)).language.parser

// Built once, and once per options object: the same syntax the editor parses, so offline trees match on-screen parsing.
const plain = parser()
const withOptions = new WeakMap<MarkdownOptions, Parser>()

/**
 * Parses markdown text to a Lezer tree with the editor's OFM configuration, plus the syntax in `options` (pass the
 * editor's `markdown` options, the same object each time, to parse what it parses).
 */
export function parseMarkdownToAST(markdownText: string, options?: MarkdownOptions): Tree {
    if (!options) return plain.parse(markdownText)
    let p = withOptions.get(options)
    if (!p) withOptions.set(options, p = parser(options))
    return p.parse(markdownText)
}
