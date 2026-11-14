import { isMap, isScalar, isSeq, parseDocument, type Document, type YAMLMap } from 'yaml'
import type { PropertyType } from '../types/editor-types'

/**
 * Frontmatter properties as Obsidian's Properties view edits them: the YAML stays a document (comments, key order,
 * quoting and flow style survive edits), and each key has a type that decides its editor.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const LIST_TYPES: Record<string, true> = { list: true, tags: true, aliases: true }

export const isListType = (type: PropertyType) => !!LIST_TYPES[type]

/** The type a value is shown as when the host hasn't set one for its key (Obsidian's defaults for `tags`/`aliases`). */
export function inferType(key: string, value: unknown): PropertyType {
    if (key === 'tags') return 'tags'
    if (key === 'aliases') return 'aliases'
    if (Array.isArray(value)) return value.every(v => v === null || typeof v !== 'object') ? 'list' : 'unknown'
    if (typeof value === 'boolean') return 'checkbox'
    if (typeof value === 'number') return 'number'
    if (value !== null && typeof value === 'object') return 'object'
    if (typeof value === 'string' && DATE.test(value)) return 'date'
    if (typeof value === 'string' && DATETIME.test(value)) return 'datetime'
    return 'text'
}

const asText = (v: unknown): string =>
    v == null ? '' : Array.isArray(v) ? v.map(asText).join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)

/** `value` adapted to `type` (Obsidian's "Display as …" conversion). Empty or incompatible values become null. */
export function convertValue(value: unknown, type: PropertyType): unknown {
    const text = asText(value).trim()
    switch (type) {
        case 'list':
        case 'tags':
        case 'aliases':
            return Array.isArray(value) ? value : text ? [text] : []
        case 'number':
            return text && Number.isFinite(Number(text)) ? Number(text) : null
        case 'checkbox':
            return typeof value === 'boolean' ? value : text === 'true'
        case 'date':
            return DATE.test(text) ? text : DATETIME.test(text) ? text.slice(0, 10) : null
        case 'datetime':
            return DATETIME.test(text) ? text : DATE.test(text) ? `${text}T00:00` : null
        case 'object':
            return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
        default:
            return text || null
    }
}

/** The YAML between `---` fences, if it is a mapping (or empty) Obsidian can show as properties; null otherwise. */
export function propertiesYaml(frontmatter: string): string | null {
    const lines = frontmatter.split('\n')
    const yaml = lines.slice(1, -1).map(l => `${l}\n`).join('')
    const doc = parseDocument(yaml)
    return doc.errors.length || !(doc.contents === null || isMap(doc.contents)) ? null : yaml
}

/** Frontmatter text for `yaml` (as returned by `editProperties`). */
export const frontmatterOf = (yaml: string) => `---\n${yaml}---`

/** Apply `edit` to the YAML document and serialize it: no line folding, empty values written as `key:`. */
export function editProperties(yaml: string, edit: (doc: Document) => void): string {
    const doc = parseDocument(yaml)
    edit(doc)
    return isMap(doc.contents) && doc.contents.items.length ? doc.toString({ lineWidth: 0, nullStr: '', flowCollectionPadding: false }) : ''
}

function pairAt(doc: Document, path: string[]) {
    const parent = path.length > 1 ? doc.getIn(path.slice(0, -1), true) : doc.contents
    if (!isMap(parent)) return null
    const key = path.at(-1)
    return { parent: parent as YAMLMap, pair: (parent as YAMLMap).items.find(p => String(isScalar(p.key) ? p.key.value : p.key) === key) ?? null }
}

/** Set the value at `path`, keeping a scalar's quoting style and a list's flow style. */
export function setProperty(doc: Document, path: string[], value: unknown) {
    const node = doc.getIn(path, true)
    if (isScalar(node) && (value === null || typeof value !== 'object')) {
        node.value = value
        return
    }
    const created = doc.createNode(value)
    if (isSeq(node) && isSeq(created)) created.flow = node.flow
    doc.setIn(path, created)
}

/** Rename the key at `path` in place (position and comments kept). False if `key` is empty or already used there. */
export function renameProperty(doc: Document, path: string[], key: string): boolean {
    const found = pairAt(doc, path)
    if (!found?.pair || !key || found.parent.items.some(p => String(isScalar(p.key) ? p.key.value : p.key) === key)) return false
    const old = found.pair.key
    const renamed = doc.createNode(key)
    if (isScalar(old)) {
        renamed.commentBefore = old.commentBefore
        renamed.spaceBefore = old.spaceBefore
    }
    found.pair.key = renamed
    return true
}

export function removeProperty(doc: Document, path: string[]) {
    doc.deleteIn(path)
}
