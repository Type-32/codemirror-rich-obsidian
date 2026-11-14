import { describe, expect, it } from 'vitest'
import { cellRange, newRow, parseTable, setCell } from '../src/runtime/utils/markdownTable'

const source = [
    '| Name     |  Link   | Num |',
    '| -------- | :-----: | --: |',
    '| a        | [[x\\|y]] |   1 |',
    '|   | b |',
].join('\n')

const put = (src: string, row: number, col: number, text: string) => {
    const r = cellRange(src, row, col)!
    return src.slice(0, r.from) + text + src.slice(r.to)
}

describe('cellRange', () => {
    it('finds every cell parseTable sees, escaped pipes included', () => {
        const t = parseTable(source)!
        for (let row = -1; row < t.rows.length; row++) {
            t.header.forEach((_, col) => {
                const r = cellRange(source, row, col)
                const text = row < 0 ? t.header[col] : t.rows[row]![col]
                if (row === 1 && col === 2) expect(r).toBeNull() // short row
                else expect(source.slice(r!.from, r!.to).trim()).toBe(text) // an empty cell's range is its inner spaces
            })
        }
    })

    it('writes into an empty cell between single spaces', () => {
        expect(put(source, 1, 0, 'x').split('\n')[3]).toBe('| x | b |')
        expect(put('| a |\n| - |\n||', 0, 0, 'x').split('\n')[2]).toBe('|x|')
    })

    it('keeps the table parsing the same after a cell write', () => {
        const next = put(source, 0, 1, '[[z]]')
        expect(parseTable(next)).toEqual(setCell(parseTable(source)!, 0, 1, '[[z]]'))
    })

    it('handles indented tables (in list items) and rows without outer pipes', () => {
        const src = '  a | b\n  --|--\n  c | d'
        expect(src.slice(cellRange(src, 0, 1)!.from, cellRange(src, 0, 1)!.to)).toBe('d')
        expect(parseTable(src + newRow(src, 2))!.rows).toEqual([['c', 'd'], ['', '']])
        expect(newRow(src, 2)).toBe('\n  |   |   |')
    })
})
