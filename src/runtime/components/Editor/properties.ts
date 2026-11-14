import type { InjectionKey } from 'vue'
import type { InternalLink, PropertyType } from '../../editor/types/editor-types'
import type { MenuSize } from '../../editor/plugins/hostAppConfig'

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
    /** The editor's `contextMenuSize`, for the type menu. */
    menuSize: () => MenuSize | undefined
    /** The editor's `internalLinkMap`, offered after `[[` in values. */
    links: () => InternalLink[]
}

export const PROPERTIES: InjectionKey<PropertiesApi> = Symbol('properties')

/**
 * The panel's menus (type menu, suggestions): translucent, with the page blurred behind, as in Obsidian. A class
 * styled in `editor.css`, which the host's Tailwind compiles (utility classes in a package's `.vue` files aren't).
 */
export const MENU_UI = 'cm-properties-menu'

/**
 * Content of the suggestion menus: Nuxt UI's defaults, plus keeping focus in the input while an item is clicked, so
 * the click picks it instead of blurring the input.
 */
export const SUGGESTIONS_CONTENT = {
    side: 'bottom', sideOffset: 8, collisionPadding: 8, position: 'popper',
    onMousedown: (e: MouseEvent) => e.preventDefault(),
} as const

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

/** `[[path#sub|alias]]` (or the embed `![[…]]`) as a link: target and shown text. */
export function wikilink(value: unknown): { target: string, text: string } | null {
    const m = typeof value === 'string' ? /^!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]$/.exec(value.trim()) : null
    return m ? { target: m[1]!, text: m[2] ?? m[1]! } : null
}

/**
 * Links to offer while a value ends in an open `[[` or `![[` (as the editor's own `[[` completion does): each with
 * the whole value it completes `text` to. Names shared by several links complete to their file path.
 */
export function linkCompletions(text: string, links: InternalLink[]): { link: InternalLink, value: string }[] | null {
    const open = /!?\[\[([^\]|]*)$/.exec(text)
    if (!open) return null
    const query = open[1]!.toLowerCase()
    const head = text.slice(0, open.index + open[0].length - open[1]!.length)
    const names = links.map(l => l.name)
    return links
        .filter(l => l.name && (l.name.toLowerCase().includes(query) || l.filePath?.toLowerCase().includes(query)))
        .map(link => ({ link, value: `${head}${link.filePath && names.indexOf(link.name) !== names.lastIndexOf(link.name) ? link.filePath : link.name}]]` }))
}
