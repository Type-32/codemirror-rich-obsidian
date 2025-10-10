import { type Ref } from 'vue'
import { dump } from 'js-yaml'
import { useEditorUtils } from './useEditorUtils'
import { parseFrontmatter } from '../utils/frontmatter'
import type { Frontmatter } from '../editor/types/editor-types'

export function useEditorFrontmatter<T extends object = {}>(editor: Ref<any>) {
    const editorUtils = useEditorUtils(editor)

    function getFrontmatter(): { data?: Frontmatter<T>; error?: Error } {
        const doc = editorUtils.getDoc()
        if (!doc) {
            return {}
        }

        // Reuse the shared parseFrontmatter utility
        return parseFrontmatter(doc) as { data?: Frontmatter<T>; error?: Error }
    }

    function setFrontmatterProperties(properties: Partial<Frontmatter<T>>) {
        const doc = editorUtils.getDoc() || ''
        const ast = editorUtils.parseMarkdownToAST(doc)
        const firstNode = ast.topNode.firstChild

        let existingData: Record<string, any> = {}
        let frontmatterNodeRange = { from: -1, to: -1 }

        if (firstNode && firstNode.name === 'YAMLFrontMatter') {
            frontmatterNodeRange = { from: firstNode.from, to: firstNode.to }
            const { data, error } = getFrontmatter()
            if (data && !error) {
                existingData = data
            }
        }
        
        const newData = { ...existingData, ...properties }
        
        Object.keys(newData).forEach(key => {
            if (newData[key] === undefined) {
                delete newData[key]
            }
        })

        const newYamlContent = Object.keys(newData).length > 0 
            ? dump(newData, { skipInvalid: true }).trim() 
            : ''
            
        const newFrontmatterBlock = `---\n${newYamlContent}\n---`

        if (frontmatterNodeRange.from !== -1) {
            editorUtils.dispatch({
                changes: { from: frontmatterNodeRange.from, to: frontmatterNodeRange.to, insert: newFrontmatterBlock }
            })
        } else {
            const insertText = doc.trim().length > 0 ? `${newFrontmatterBlock}\n\n` : newFrontmatterBlock
            editorUtils.dispatch({
                changes: { from: 0, to: 0, insert: insertText }
            })
        }
    }

    function addFrontmatterProperty(key: string, value: any) {
        setFrontmatterProperties({ [key]: value } as Partial<Frontmatter<T>>)
    }

    function removeFrontmatterProperty(key: string) {
        setFrontmatterProperties({ [key]: undefined } as Partial<Frontmatter<T>>)
    }

    return {
        getFrontmatter,
        setFrontmatterProperties,
        addFrontmatterProperty,
        removeFrontmatterProperty,
    }
}
