import type { InternalLink } from '../types/editor-types'

/** One `[[` completion: what the list shows and what replaces the text typed after `[[`. */
export interface LinkSuggestion {
    kind: 'note' | 'alias' | 'heading' | 'block'
    label: string
    /** Second line: the file path of a note, the note an alias or heading belongs to, a block's `^id`. */
    detail?: string
    insert: string
}

/** Icon of each kind of suggestion, in every `[[` list (the note's and the properties panel's). */
export const LINK_ICONS: Record<LinkSuggestion['kind'], string> = {
    note: 'i-lucide-file-text',
    alias: 'i-lucide-forward',
    heading: 'i-lucide-heading',
    block: 'i-lucide-square-dashed-text',
}

/** Headings and blocks of the note being edited, for `[[#…` and `[[#^…`. */
export interface NoteTargets {
    headings: string[]
    blocks: { id: string, text?: string }[]
}

interface Entry {
    link: InternalLink
    /** Lower-cased name or alias, matched against what's typed. */
    key: string
    path: string
    alias?: string
    /** What a completion writes for the note: its name, or its file path when several links share the name. */
    target: string
}

/** Each link map prepared for searching (one entry per name and alias), built once per map array. */
const indexes = new WeakMap<readonly InternalLink[], Entry[]>()

function indexOf(links: readonly InternalLink[]): Entry[] {
    let index = indexes.get(links)
    if (!index) {
        const counts = new Map<string, number>()
        for (const l of links) counts.set(l.name, (counts.get(l.name) ?? 0) + 1)
        index = links.filter(l => l.name).flatMap((link) => {
            const target = counts.get(link.name)! > 1 && link.filePath ? link.filePath : link.name
            const path = link.filePath?.toLowerCase() ?? ''
            return [
                { link, key: link.name.toLowerCase(), path, target },
                ...(link.aliases ?? []).map(alias => ({ link, key: alias.toLowerCase(), path: '', alias, target })),
            ]
        })
        indexes.set(links, index)
    }
    return index
}

/** `query`'s characters appear in `text` in order (`mnt` → "My Note"). */
function subsequence(text: string, query: string): boolean {
    let i = 0
    for (const c of text) if (c === query[i]) i++
    return i === query.length
}

/** How well `key` (or `path`) matches `q`, lower is better, -1 for no match: exact, prefix, word start, inside, path, fuzzy. */
function rank(key: string, q: string, path = ''): number {
    if (!q || key === q) return 0
    if (key.startsWith(q)) return 1
    const at = key.indexOf(q)
    if (at > 0) return /[\s\-_./]/.test(key[at - 1]!) ? 2 : 3
    if (path.includes(q)) return 4
    return subsequence(key, q) ? 5 : -1
}

/** `items` matching `query` by `keyOf`, best first; with nothing typed, in their own order. */
function ranked<T>(items: T[], query: string, keyOf: (item: T) => string, pathOf?: (item: T) => string): T[] {
    const q = query.toLowerCase()
    const matches: { item: T, r: number, len: number }[] = []
    for (const item of items) {
        const key = keyOf(item).toLowerCase()
        const r = rank(key, q, pathOf?.(item))
        if (r >= 0) matches.push({ item, r, len: key.length })
    }
    if (q) matches.sort((a, b) => a.r - b.r || a.len - b.len)
    return matches.map(m => m.item)
}

/**
 * Completions for the text typed after `[[` (or `![[`), as Obsidian offers them:
 * - `name`: notes and their aliases, ranked (exact, prefix, word start, inside, file path, fuzzy; shorter first), in
 *   link-map order while nothing is typed. An alias completes to `name|alias`;
 * - `name#text`: that note's headings; `name#^text`: its blocks (`InternalLink.headings` / `.blocks`);
 * - `#text` and `#^text`: the headings and blocks of the note being edited (`here`, read only then).
 *
 * Every match is returned; lists render only the rows in view. Shared by the editor and the properties panel.
 */
export function linkSuggestions(query: string, links: readonly InternalLink[], here: () => NoteTargets): LinkSuggestion[] {
    const hash = query.indexOf('#')
    if (hash < 0) {
        return ranked(indexOf(links), query, e => e.key, e => e.path).map(e => e.alias
            ? { kind: 'alias', label: e.alias, detail: e.link.name, insert: `${e.target}|${e.alias}` }
            : { kind: 'note', label: e.link.name, detail: e.link.filePath, insert: e.target })
    }
    const note = query.slice(0, hash)
    const lower = note.toLowerCase()
    const link = note ? links.find(l => l.name.toLowerCase() === lower || l.filePath?.toLowerCase() === lower) : null
    if (note && !link) return []
    // The note as written in the link: its name, or its path when that's what was typed (case as in the link map).
    const base = !link ? '' : link.filePath?.toLowerCase() === lower ? link.filePath : link.name
    const targets = link ?? here()
    const sub = query.slice(hash + 1)
    if (sub.startsWith('^')) {
        return ranked(targets.blocks ?? [], sub.slice(1), b => `${b.id} ${b.text ?? ''}`)
            .map(b => ({ kind: 'block', label: b.text || b.id, detail: `^${b.id}`, insert: `${base}#^${b.id}` }))
    }
    return ranked(targets.headings ?? [], sub, h => h)
        .map(h => ({ kind: 'heading', label: h, detail: link?.name, insert: `${base}#${h}` }))
}
