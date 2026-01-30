import { type Ref } from 'vue'
import { useEditorUtils } from './useEditorUtils'
import { parseFrontmatter, stringifyYaml } from '../utils/frontmatter'
import type { Frontmatter } from '../editor/types/editor-types'

export function useEditorFrontmatter<T extends object = {}>(editor: Ref<any>) {
    const editorUtils = useEditorUtils(editor)

    function getFrontmatter(): { data?: T; error?: Error } {
		try {
			const doc = editorUtils.getDoc()
			if (!doc) {
				return { error: new Error('No document object found') }
			}

			// Reuse the shared parseFrontmatter utility
			return parseFrontmatter(doc) as { data?: T; error?: Error }
		} catch (e) {
			console.log(e)
			return { error: e as Error }
		}
    }

    /**
     * Updates existing frontmatter properties by merging with new values.
     * Preserves existing properties and adds/updates specified ones.
     */
    function updateFrontmatterProperties(properties: Partial<T>): boolean {
		try {
			const doc = editorUtils.getDoc()
			if (!doc) return false

			let existingData: Record<string, any> = {}

			// Fast check: Does frontmatter exist?
			if (doc.startsWith('---\n') || doc.startsWith('---\r\n')) {
				const { data, error } = getFrontmatter()
				if (data && !error) {
					existingData = data
				}
			}

			// Merge existing data with new properties
			const newData = { ...existingData, ...properties }

			return setFrontmatterProperties(newData)
		} catch (e) {
			console.error('Error updating frontmatter:', e)
			return false
		}
    }

	/**
	 * Sets frontmatter properties, replacing all existing frontmatter.
	 * If properties object is empty or all values are undefined, removes frontmatter entirely.
	 */
	function setFrontmatterProperties(properties: Partial<T>): boolean {
		try {
			const doc = editorUtils.getDoc()
			if (doc === undefined) return false

			// Clean up undefined values
			const newData: Partial<T> & Record<string, any> = { ...properties }
			Object.keys(newData).forEach(key => {
				if (newData[key] === undefined) {
					delete newData[key]
				}
			})

			// Check if there's any content to write
			const hasContent = Object.keys(newData).length > 0

			// Fast frontmatter detection using string operations
			let frontmatterStart = -1
			let frontmatterEnd = -1

			if (doc.startsWith('---\n') || doc.startsWith('---\r\n')) {
				frontmatterStart = 0
				const yamlStart = doc.indexOf('\n', 3) + 1
				const closingFenceIndex = doc.indexOf('\n---', yamlStart)
				
				if (closingFenceIndex !== -1) {
					const afterFence = closingFenceIndex + 4
					const nextChar = doc[afterFence]
					if (nextChar === undefined || nextChar === '\n' || nextChar === '\r') {
						frontmatterEnd = afterFence
					}
				}
			}

			const hasFrontmatter = frontmatterStart !== -1 && frontmatterEnd !== -1

			if (!hasContent) {
				// Remove frontmatter entirely if no properties
				if (hasFrontmatter) {
					let removeEnd = frontmatterEnd
					// Skip up to 2 newlines after the frontmatter
					if (doc[removeEnd] === '\n' || doc[removeEnd] === '\r') removeEnd++
					if (doc[removeEnd] === '\n' || doc[removeEnd] === '\r') removeEnd++

					editorUtils.dispatch({
						changes: { from: frontmatterStart, to: removeEnd, insert: '' },
					})
					return true
				}
				return false
			}

			// Generate YAML content
			const yamlResult = stringifyYaml(newData)
			if (yamlResult.error) {
				console.error('Error converting data to YAML:', yamlResult.error)
				return false
			}
			const newFrontmatterBlock = `---\n${yamlResult.yaml}\n---`

			if (hasFrontmatter) {
				// Replace existing frontmatter
				editorUtils.dispatch({
					changes: {
						from: frontmatterStart,
						to: frontmatterEnd,
						insert: newFrontmatterBlock,
					},
				})
			} else {
				// Insert new frontmatter at the beginning
				const insertText = doc.trim().length > 0 ? `${newFrontmatterBlock}\n\n` : `${newFrontmatterBlock}\n`
				editorUtils.dispatch({
					changes: { from: 0, to: 0, insert: insertText },
				})
			}

			return true
		} catch (e) {
			console.error('Error setting frontmatter:', e)
			return false
		}
	}

	/**
	 * Completely removes the frontmatter from the document if it exists.
	 * Includes the YAML delimiters and any trailing newlines.
	 */
	function clearFrontmatter(): boolean {
		try {
			const doc = editorUtils.getDoc()
			if (!doc) return false

			// Fast frontmatter detection
			if (!doc.startsWith('---\n') && !doc.startsWith('---\r\n')) {
				return true // No frontmatter to remove
			}

			const yamlStart = doc.indexOf('\n', 3) + 1
			if (yamlStart === 0) return true

			const closingFenceIndex = doc.indexOf('\n---', yamlStart)
			if (closingFenceIndex === -1) return true

			const afterFence = closingFenceIndex + 4
			const nextChar = doc[afterFence]
			if (nextChar !== undefined && nextChar !== '\n' && nextChar !== '\r') {
				return true // Not a valid closing fence
			}

			let removeEnd = afterFence
			// Skip up to 2 newlines after the frontmatter
			if (doc[removeEnd] === '\n' || doc[removeEnd] === '\r') removeEnd++
			if (doc[removeEnd] === '\n' || doc[removeEnd] === '\r') removeEnd++

			editorUtils.dispatch({
				changes: { from: 0, to: removeEnd, insert: '' },
			})

			return true
		} catch (e) {
			console.error('Error clearing frontmatter:', e)
			return false
		}
	}

    function addFrontmatterProperty(key: string, value: any): boolean {
        return updateFrontmatterProperties({ [key]: value } as Partial<T>)
    }

    function removeFrontmatterProperty(key: string): boolean {
        return updateFrontmatterProperties({ [key]: undefined } as Partial<T>)
    }

    return {
        getFrontmatter,
        updateFrontmatterProperties,
		setFrontmatterProperties,
		clearFrontmatter,
        addFrontmatterProperty,
        removeFrontmatterProperty,
    }
}
