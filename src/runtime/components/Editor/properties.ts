import type { InjectionKey } from 'vue'
import type { PropertyType } from '../../editor/types/editor-types'

/** What `PropertiesPanel` gives its rows: edits go back to the editor as one YAML rewrite each. */
export interface PropertiesApi {
    editable: boolean
    t: (key: string, fallback: string) => string
    typeOf: (path: string[], value: unknown) => PropertyType
    setValue: (path: string[], value: unknown) => void
    /** False when the name is empty or taken. */
    rename: (path: string[], key: string) => boolean
    remove: (path: string[]) => void
    setType: (path: string[], type: PropertyType, value: unknown) => void
    valueSuggestions: (key: string) => string[]
    openLink: (target: string, display?: string) => void
    /** Focus a row after the YAML it renders from has been rewritten. */
    focusRow: (path: string[]) => void
}

export const PROPERTIES: InjectionKey<PropertiesApi> = Symbol('properties')

/** Row identity in the DOM (`data-property-path`). */
export const pathId = (path: string[]) => JSON.stringify(path)

export const TYPE_ICONS: Record<PropertyType, string> = {
    text: 'i-lucide-text',
    list: 'i-lucide-list',
    number: 'i-lucide-binary',
    checkbox: 'i-lucide-square-check',
    date: 'i-lucide-calendar',
    datetime: 'i-lucide-clock',
    tags: 'i-lucide-tags',
    aliases: 'i-lucide-forward',
    object: 'i-lucide-braces',
    unknown: 'i-lucide-circle-help',
}

export const TYPE_LABELS: Record<PropertyType, string> = {
    text: 'Text', list: 'List', number: 'Number', checkbox: 'Checkbox', date: 'Date', datetime: 'Date & time',
    tags: 'Tags', aliases: 'Aliases', object: 'Object', unknown: 'Unknown',
}

/** `[[path#sub|alias]]` as a link: target and shown text. */
export function wikilink(value: unknown): { target: string, text: string } | null {
    const m = typeof value === 'string' ? /^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]$/.exec(value.trim()) : null
    return m ? { target: m[1]!, text: m[2] ?? m[1]! } : null
}
