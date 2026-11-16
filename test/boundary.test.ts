import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const FRAMEWORK = /^(vue|@vue\/|@vueuse\/|vue-codemirror6|nuxt|@nuxt\/|#)/

/** Every module the file reaches through static and type imports, and the framework imports among them. */
function walk(entry: string) {
    const seen = new Set<string>(), framework: string[] = []
    const visit = (file: string) => {
        if (seen.has(file)) return
        seen.add(file)
        for (const [, spec] of readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
            if (!spec!.startsWith('.')) {
                if (FRAMEWORK.test(spec!)) framework.push(`${file.split('/src/')[1]} → ${spec}`)
                continue
            }
            const base = resolve(dirname(file), spec!)
            if (base.endsWith('.vue')) framework.push(`${file.split('/src/')[1]} → ${spec}`)
            else visit([`${base}.ts`, `${base}/index.ts`, base].find(existsSync)!)
        }
    }
    visit(entry)
    return { seen, framework }
}

describe('the core entry', () => {
    it('imports no Vue, Nuxt or .vue file, not even types', () => {
        const { seen, framework } = walk(resolve(__dirname, '../src/runtime/index.ts'))
        expect(seen.size).toBeGreaterThan(30)
        expect(framework).toEqual([])
    })

    it('nor does the comark plugin (`/comark`)', () => {
        expect(walk(resolve(__dirname, '../src/runtime/comark/index.ts')).framework).toEqual([])
    })
})
