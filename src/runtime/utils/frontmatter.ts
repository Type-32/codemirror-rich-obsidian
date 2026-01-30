import { load, dump } from 'js-yaml'
import type { Frontmatter } from '../editor/types/editor-types';

/**
 * Converts a JavaScript object/data into a YAML string suitable for writing to files.
 * 
 * @param data - The data to convert to YAML
 * @param options - Optional formatting options
 * @returns YAML string or error object
 * 
 * @example
 * ```typescript
 * interface Config {
 *   title: string
 *   count: number
 *   tags: string[]
 * }
 * 
 * const data: Config = {
 *   title: 'Hello',
 *   count: 42,
 *   tags: ['vue', 'nuxt']
 * }
 * 
 * const result = stringifyYaml(data)
 * if (result.yaml) {
 *   console.log(result.yaml)
 *   // Output:
 *   // title: Hello
 *   // count: 42
 *   // tags:
 *   //   - vue
 *   //   - nuxt
 * }
 * ```
 */
export function stringifyYaml(
    data: any,
    options?: {
        /** Number of spaces for indentation (default: 2) */
        indent?: number
        /** Skip invalid types instead of throwing (default: true) */
        skipInvalid?: boolean
        /** Maximum line width (default: 80) */
        lineWidth?: number
        /** Sort object keys (default: false) */
        sortKeys?: boolean
    }
): { yaml?: string; error?: Error } {
    if (data === null || data === undefined) {
        return { yaml: '' }
    }

    try {
        const yaml = dump(data, {
            indent: options?.indent ?? 2,
            skipInvalid: options?.skipInvalid ?? true,
            lineWidth: options?.lineWidth ?? 80,
            sortKeys: options?.sortKeys ?? false,
        })

        return { yaml: yaml.trim() }
    } catch (e: any) {
        return { error: e }
    }
}

/**
 * Parses a YAML/YML string into the specified type.
 * 
 * @param yamlString - The YAML string to parse
 * @returns Parsed data or error object
 * 
 * @example
 * ```typescript
 * interface Config {
 *   title: string
 *   count: number
 * }
 * 
 * const yaml = 'title: Hello\ncount: 42'
 * const result = parseYaml<Config>(yaml)
 * if (result.data) {
 *   console.log(result.data.title) // "Hello"
 * }
 * ```
 */
export function parseYaml<T = any>(yamlString: string): { data?: T; error?: Error } {
    if (!yamlString || yamlString.trim().length === 0) {
        return { data: {} as T }
    }

    try {
        const data = load(yamlString)

        if (data === null || data === undefined) {
            return { data: {} as T }
        }

        if (typeof data === 'object') {
            return { data: data as T }
        }

        // If parsed data is a primitive, wrap it
        return { data: data as T }
    } catch (e: any) {
        return { error: e }
    }
}

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

    // Parse the YAML content using the shared parseYaml function
    const result = parseYaml<Frontmatter>(yamlContent)
    
    // Validate that frontmatter is an object (not a primitive)
    if (result.data && typeof result.data !== 'object') {
        return { error: new Error('Frontmatter is not a valid object.') }
    }

    return result
}
