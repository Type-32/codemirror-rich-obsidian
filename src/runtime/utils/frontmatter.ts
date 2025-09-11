import { load } from 'js-yaml'

const frontmatterRegex = /^---\r?\n([\s\S]+?)\r?\n---/

export function parseFrontmatter(markdown: string): { data?: Record<string, any>; error?: Error } {
    if (!markdown) {
        return {}
    }

    const match = markdown.match(frontmatterRegex)

    if (!match) {
        // If the string starts with --- but doesn't match, it's incomplete.
        if (markdown.startsWith('---')) {
            return { error: new Error('Incomplete frontmatter block.') }
        }
        // Otherwise, there's just no frontmatter.
        return {}
    }

    const yamlContent = match[1]

    try {
        const data = load(yamlContent || '')
        if (typeof data === 'object' && data !== null) {
            return { data: data as Record<string, any> }
        }
        // The YAML is valid but not an object (e.g., a single string)
        return { error: new Error('Frontmatter is not a valid object.') }
    } catch (e: any) {
        return { error: e }
    }
}
