export type TableAlign = 'left' | 'center' | 'right' | null

export interface TableModel {
    header: string[]
    align: TableAlign[]
    rows: string[][]
}

/** Split a `| a | b |` line on unescaped pipes; trims cells; drops the outer empties. */
function splitRow(line: string): string[] {
    const at = pipes(line)
    const cells = at.slice(1).map((end, i) => line.slice(at[i]! + 1, end).trim())
    if (cells.length && cells[0] === '') cells.shift()
    if (cells.length && cells[cells.length - 1] === '') cells.pop()
    return cells
}

/** Parses GFM table source. Returns null when the delimiter row is missing/invalid. */
export function parseTable(source: string): TableModel | null {
    const lines = source.split('\n').filter(l => l.trim())
    if (lines.length < 2) return null
    const header = splitRow(lines[0]!)
    const delim = splitRow(lines[1]!)
    if (!header.length || delim.length !== header.length || !delim.every(d => /^:?-+:?$/.test(d))) return null
    const align = delim.map<TableAlign>(d => d.startsWith(':') && d.endsWith(':') ? 'center' : d.startsWith(':') ? 'left' : d.endsWith(':') ? 'right' : null)
    const rows = lines.slice(2).map(l => {
        const c = splitRow(l)
        return header.map((_, i) => c[i] ?? '')
    })
    return { header, align, rows }
}

/** Offsets of the cell boundaries in `line`: before the first segment, each unescaped pipe, and the end. */
function pipes(line: string): number[] {
    const at = [-1]
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '\\' && line[i + 1] === '|') i++
        else if (line[i] === '|') at.push(i)
    }
    at.push(line.length)
    return at
}

/**
 * Where a cell's text sits in the table `source` (`row` -1 is the header): its trimmed text, or for an empty cell
 * the whitespace inside it less one space on each side, so typing there gives `| x |`. Null when the row is too short
 * to have that cell (GFM allows it). Rows are counted the way `parseTable` counts them.
 */
export function cellRange(source: string, row: number, col: number): { from: number, to: number } | null {
    const target = row < 0 ? 0 : row + 2 // line 1 is the delimiter row
    let offset = 0, n = 0
    for (const line of source.split('\n')) {
        if (line.trim() && n++ === target) {
            const at = pipes(line)
            const cells = at.slice(1).map((end, i) => [at[i]! + 1, end] as const)
            const blank = ([a, b]: readonly [number, number]) => !line.slice(a, b).trim()
            if (cells.length && blank(cells[0]!)) cells.shift()
            if (cells.length && blank(cells[cells.length - 1]!)) cells.pop()
            const cell = cells[col]
            if (!cell) return null
            let [from, to] = cell
            if (blank(cell)) {
                from = Math.min(from + 1, to)
                to = Math.max(from, to - 1)
            }
            else {
                while (/\s/.test(line[from]!)) from++
                while (/\s/.test(line[to - 1]!)) to--
            }
            return { from: offset + from, to: offset + to }
        }
        offset += line.length + 1
    }
    return null
}

/** A new empty row to append to the table `source` (`\n` included), indented like its last line. */
export function newRow(source: string, cols: number): string {
    const last = source.slice(source.lastIndexOf('\n') + 1)
    return `\n${/^\s*/.exec(last)![0]}|${'   |'.repeat(cols)}`
}

/** Cell text as it must appear in the source: one line, and pipes escaped so they can't split the cell. */
export const escapeCell = (text: string) => text.replace(/\n/g, ' ').replace(/(?<!\\)\|/g, '\\|')

/** Serializes with padded columns so the source stays readable. */
export function serializeTable(t: TableModel): string {
    const cols = t.header.length
    const width = (i: number) => Math.max(3, t.header[i]!.length, ...t.rows.map(r => (r[i] ?? '').length))
    const pad = (s: string, i: number, a: TableAlign) => {
        const w = width(i), gap = w - s.length
        if (a === 'right') return ' '.repeat(gap) + s
        if (a === 'center') return ' '.repeat(Math.floor(gap / 2)) + s + ' '.repeat(Math.ceil(gap / 2))
        return s + ' '.repeat(gap)
    }
    const row = (cells: string[]) => `| ${cells.map((c, i) => pad(c, i, t.align[i] ?? null)).join(' | ')} |`
    const delim = `| ${t.align.map((a, i) => {
        const dashes = '-'.repeat(width(i) - (a === 'center' ? 2 : a ? 1 : 0))
        return a === 'center' ? `:${dashes}:` : a === 'left' ? `:${dashes}` : a === 'right' ? `${dashes}:` : dashes
    }).join(' | ')} |`
    return [row(t.header), delim, ...t.rows.map(row)].join('\n')
}

// ── Structural operations. Each returns a new model; `cols` must be ≥ 1, `rows` may be 0. ──

const clone = (t: TableModel): TableModel => ({ header: [...t.header], align: [...t.align], rows: t.rows.map(r => [...r]) })

export function insertRow(t: TableModel, at: number): TableModel {
    const n = clone(t)
    n.rows.splice(at, 0, t.header.map(() => ''))
    return n
}

export function deleteRow(t: TableModel, at: number): TableModel {
    const n = clone(t)
    n.rows.splice(at, 1)
    return n
}

export function moveRow(t: TableModel, from: number, to: number): TableModel {
    const n = clone(t)
    const [r] = n.rows.splice(from, 1)
    n.rows.splice(to, 0, r!)
    return n
}

export function insertCol(t: TableModel, at: number): TableModel {
    const n = clone(t)
    n.header.splice(at, 0, '')
    n.align.splice(at, 0, null)
    for (const r of n.rows) r.splice(at, 0, '')
    return n
}

export function deleteCol(t: TableModel, at: number): TableModel | null {
    if (t.header.length <= 1) return null
    const n = clone(t)
    n.header.splice(at, 1)
    n.align.splice(at, 1)
    for (const r of n.rows) r.splice(at, 1)
    return n
}

export function moveCol(t: TableModel, from: number, to: number): TableModel {
    const n = clone(t)
    const mv = <T>(a: T[]) => { const [x] = a.splice(from, 1); a.splice(to, 0, x!) }
    mv(n.header); mv(n.align)
    for (const r of n.rows) mv(r)
    return n
}

export function setAlign(t: TableModel, col: number, align: TableAlign): TableModel {
    const n = clone(t)
    n.align[col] = align
    return n
}

export function setCell(t: TableModel, row: number, col: number, text: string): TableModel {
    const n = clone(t)
    const safe = escapeCell(text)
    if (row < 0) n.header[col] = safe
    else n.rows[row]![col] = safe
    return n
}
