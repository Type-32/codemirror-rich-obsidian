import { load } from 'js-yaml'
import type { Frontmatter } from '../editor/types/editor-types';

/**
 * Lightning-fast frontmatter parser using string operations instead of AST parsing.
 * Optimized for performance - parses in microseconds instead of milliseconds.
 */
export function parseFrontmatter(markdownText: string): { data?: Frontmatter; error?: Error } {
    if (!markdownText) {
        return { error: new Error('No markdown text provided') }
    }

    // Fast check: Does the document start with the frontmatter fence?
    if (!markdownText.startsWith('---\n') && !markdownText.startsWith('---\r\n')) {
        return { data: {} }
    }

    // Find the start of the YAML content (after the opening fence)
    const yamlStart = markdownText.indexOf('\n', 3) + 1
    if (yamlStart === 0) {
        return { data: {} }
    }

    // Find the closing fence (must be on its own line)
    const closingFenceIndex = markdownText.indexOf('\n---', yamlStart)
    if (closingFenceIndex === -1) {
        return { data: {} }
    }

    // Verify the closing fence is actually a fence (followed by newline or end of string)
    const afterFence = closingFenceIndex + 4 // Position after "\n---"
    const nextChar = markdownText[afterFence]
    if (nextChar !== undefined && nextChar !== '\n' && nextChar !== '\r') {
        // Not a valid closing fence, keep searching
        return { data: {} }
    }

    // Extract the YAML content between the fences
    const yamlContent = markdownText.slice(yamlStart, closingFenceIndex)

    try {
        const data = load(yamlContent)

        if (data === null || data === undefined) {
            return { data: {} }
        }

        if (typeof data === 'object') {
            return { data: data as Frontmatter }
        }

        return { error: new Error('Frontmatter is not a valid object.') }
    } catch (e: any) {
        return { error: e }
    }
}
