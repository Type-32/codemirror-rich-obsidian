import { parse, stringify } from 'yaml'
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
    data: unknown,
    options?: {
        /** Number of spaces for indentation (default: 2) */
        indent?: number
        /** Maximum line width; 0 never folds (default: 80) */
        lineWidth?: number
        /** Sort object keys (default: false) */
        sortKeys?: boolean
    }
): { yaml?: string; error?: Error } {
    if (data === null || data === undefined) {
        return { yaml: '' }
    }

    try {
        const yaml = stringify(data, {
            indent: options?.indent ?? 2,
            lineWidth: options?.lineWidth ?? 80,
            sortMapEntries: options?.sortKeys ?? false,
        })

        return { yaml: yaml.trim() }
    } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) }
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
export function parseYaml<T = unknown>(yamlString: string): { data?: T; error?: Error } {
    if (!yamlString || yamlString.trim().length === 0) {
        return { data: {} as T }
    }

    try {
        const data = parse(yamlString)
        return { data: (data ?? {}) as T }
    } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) }
    }
}

/**
 * Byte range of the leading `---` fenced block, or null when the doc has none.
 * `unclosed` is true when the doc opens a fence that never closes — callers must not
 * insert a new block in front of it (that would leave a stray `---` and corrupt the doc).
 */
export function frontmatterRange(markdownText: string): { from: 0; to: number; yaml: string } | { unclosed: true } | null {
    if (!markdownText.startsWith('---\n') && !markdownText.startsWith('---\r\n')) return null
    const yamlStart = markdownText.indexOf('\n', 3) + 1
    const close = markdownText.indexOf('\n---', yamlStart)
    if (close === -1) return { unclosed: true }
    const after = close + 4 // past "\n---"
    const next = markdownText[after]
    if (next !== undefined && next !== '\n' && next !== '\r') return { unclosed: true }
    return { from: 0, to: after, yaml: markdownText.slice(yamlStart, close) }
}

/** String-scan frontmatter parse (no AST). Unclosed or absent fence → `{ data: {} }`. */
export function parseFrontmatter(markdownText: string): { data?: Frontmatter; error?: Error } {
    if (!markdownText) return { error: new Error('No markdown text provided') }
    const range = frontmatterRange(markdownText)
    if (!range || 'unclosed' in range) return { data: {} }
    const result = parseYaml<Frontmatter>(range.yaml)
    if (result.data && typeof result.data !== 'object') return { error: new Error('Frontmatter is not a valid object.') }
    return result
}
