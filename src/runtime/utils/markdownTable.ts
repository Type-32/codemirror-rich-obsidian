export type TableAlign = 'left' | 'center' | 'right' | null

export interface TableModel {
    header: string[]
    align: TableAlign[]
    rows: string[][]
}

/** Split a `| a | b |` line on unescaped pipes; trims cells; drops the outer empties. */
function splitRow(line: string): string[] {
    const cells: string[] = []
    let cur = ''
    for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '\\' && line[i + 1] === '|') { cur += '\\|'; i++ }
        else if (ch === '|') { cells.push(cur.trim()); cur = '' }
        else cur += ch
    }
    cells.push(cur.trim())
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
    // Pipes would split the cell; escape so the table shape is stable. No newlines in GFM cells.
    const safe = text.replace(/\n/g, ' ').replace(/(?<!\\)\|/g, '\\|')
    if (row < 0) n.header[col] = safe
    else n.rows[row]![col] = safe
    return n
}
