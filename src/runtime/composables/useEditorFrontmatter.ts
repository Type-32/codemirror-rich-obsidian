import { type Ref } from 'vue'
import { useEditorUtils } from './useEditorUtils'
import { frontmatterRange, parseFrontmatter, stringifyYaml } from '../utils/frontmatter'

export function useEditorFrontmatter<T extends object = {}>(editor: Ref<any>) {
    const editorUtils = useEditorUtils(editor)

    function getFrontmatter(): { data?: T; error?: Error } {
        const doc = editorUtils.getDoc()
        if (!doc) return { error: new Error('No document object found') }
        return parseFrontmatter(doc) as { data?: T; error?: Error }
    }

    /** Merges `properties` into the existing frontmatter (undefined values delete keys). */
    function updateFrontmatterProperties(properties: Partial<T>): boolean {
        const { data } = getFrontmatter()
        return setFrontmatterProperties({ ...(data ?? {}), ...properties })
    }

    /**
     * Replaces the whole frontmatter with `properties`. Empty object → removes the block.
     * Refuses (returns false) when the doc opens a `---` fence that never closes, instead of
     * prepending a second block in front of it.
     */
    function setFrontmatterProperties(properties: Partial<T>): boolean {
        const doc = editorUtils.getDoc()
        if (doc === undefined) return false
        const range = frontmatterRange(doc)
        if (range && 'unclosed' in range) {
            console.error('Unclosed frontmatter fence; refusing to modify')
            return false
        }

        const data = Object.fromEntries(Object.entries(properties).filter(([, v]) => v !== undefined))
        if (Object.keys(data).length === 0) return range ? clearFrontmatter() : false

        const yaml = stringifyYaml(data)
        if (yaml.error) {
            console.error('Error converting data to YAML:', yaml.error)
            return false
        }
        const block = `---\n${yaml.yaml}\n---`
        if (range) editorUtils.dispatch({ changes: { from: range.from, to: range.to, insert: block } })
        else editorUtils.dispatch({ changes: { from: 0, to: 0, insert: doc.trim() ? `${block}\n\n` : `${block}\n` } })
        return true
    }

    /** Removes the frontmatter block plus up to two trailing newlines. */
    function clearFrontmatter(): boolean {
        const doc = editorUtils.getDoc()
        if (!doc) return false
        const range = frontmatterRange(doc)
        if (!range || 'unclosed' in range) return true
        let to = range.to
        for (let i = 0; i < 2 && (doc[to] === '\n' || doc[to] === '\r'); i++) to++
        editorUtils.dispatch({ changes: { from: 0, to, insert: '' } })
        return true
    }

    return {
        getFrontmatter,
        updateFrontmatterProperties,
        setFrontmatterProperties,
        clearFrontmatter,
        addFrontmatterProperty: (key: string, value: unknown) => updateFrontmatterProperties({ [key]: value } as Partial<T>),
        removeFrontmatterProperty: (key: string) => updateFrontmatterProperties({ [key]: undefined } as Partial<T>),
    }
}
