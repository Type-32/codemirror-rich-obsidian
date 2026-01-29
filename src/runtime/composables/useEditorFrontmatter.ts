import { type Ref, computed } from 'vue'
import { dump } from 'js-yaml'
import { useEditorUtils } from './useEditorUtils'
import { parseFrontmatter } from '../utils/frontmatter'
import type { Frontmatter } from '../editor/types/editor-types'

export function useEditorFrontmatter<T extends object = {}>(editor: Ref<any>) {
    const editorUtils = useEditorUtils(editor)

	/**
	 * Reactive computed property that automatically updates when the document changes.
	 * Returns parsed frontmatter data and any parsing errors.
	 */
	const frontmatter = computed<{ data?: T; error?: Error }>(() => {
		try {
			const doc = editorUtils.doc.value
			if (!doc) {
				return {}
			}
			return parseFrontmatter(doc) as { data?: T; error?: Error }
		} catch (e) {
			console.error('Error parsing frontmatter:', e)
			return { error: e as Error }
		}
	})

	/**
	 * Returns the current frontmatter data.
	 * For reactive access, use the `frontmatter` computed property instead.
	 */
    function getFrontmatter(): { data?: T; error?: Error } {
		return frontmatter.value
    }

    /**
     * Updates existing frontmatter properties by merging with new values.
     * Preserves existing properties and adds/updates specified ones.
     */
    function updateFrontmatterProperties(properties: Partial<T>): boolean {
		try {
			const doc = editorUtils.getDoc()
			if (!doc) {
				console.warn('Editor not initialized or document is empty')
				return false
			}

			const ast = editorUtils.getDocAst()
			if (!ast) {
				console.warn('Failed to parse document AST')
				return false
			}

			const firstNode = ast.topNode.firstChild

			let existingData: Record<string, any> = {}

			// Check for both possible frontmatter node names
			if (firstNode && (firstNode.name === 'Frontmatter' || firstNode.name === 'YAMLFrontMatter')) {
				const { data, error } = getFrontmatter()
				if (data && !error) {
					existingData = data
				}
			}

			// Merge existing data with new properties
			const newData = { ...existingData, ...properties }

			return setFrontmatterProperties(newData)
		} catch (e) {
			console.error('Error updating frontmatter properties:', e)
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
			if (doc === undefined) {
				console.warn('Editor not initialized or document is empty')
				return false
			}

			// Clean up undefined values first
			const newData: Partial<T> & Record<string, any> = { ...properties }
			Object.keys(newData).forEach(key => {
				if (newData[key] === undefined) {
					delete newData[key]
				}
			})

			// Check if there's any content to write
			const hasContent = Object.keys(newData).length > 0

			// Manually find frontmatter boundaries in the document
			let frontmatterStart = -1
			let frontmatterEnd = -1

			// Check if document starts with frontmatter fence
			if (doc.startsWith('---\n') || doc.startsWith('---\r\n')) {
				frontmatterStart = 0
				// Find the closing fence
				const searchStart = doc.indexOf('\n', 3) + 1 // Start after the opening fence
				const closingFenceIndex = doc.indexOf('\n---', searchStart)
				
				if (closingFenceIndex !== -1) {
					// Found closing fence, include it in the range
					frontmatterEnd = closingFenceIndex + 4 // Position after "---"
					
					// Check if there's a newline after the closing fence
					if (doc[frontmatterEnd] === '\n' || doc[frontmatterEnd] === '\r') {
						// Don't include it in the frontmatter range - we'll handle it separately
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
				// If no frontmatter exists and no content, return false
				return false
			}

			// Generate YAML content
			const newYamlContent = dump(newData, { skipInvalid: true }).trim()
			const newFrontmatterBlock = `---\n${newYamlContent}\n---`

			if (hasFrontmatter) {
				// Replace existing frontmatter (excluding trailing newlines)
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
			console.error('Error setting frontmatter properties:', e)
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
			if (!doc) {
				console.warn('Editor not initialized or document is empty')
				return false
			}

			// Manually find frontmatter boundaries
			let frontmatterStart = -1
			let frontmatterEnd = -1

			// Check if document starts with frontmatter fence
			if (doc.startsWith('---\n') || doc.startsWith('---\r\n')) {
				frontmatterStart = 0
				// Find the closing fence
				const searchStart = doc.indexOf('\n', 3) + 1
				const closingFenceIndex = doc.indexOf('\n---', searchStart)
				
				if (closingFenceIndex !== -1) {
					frontmatterEnd = closingFenceIndex + 4 // Position after "---"
				}
			}

			if (frontmatterStart !== -1 && frontmatterEnd !== -1) {
				let removeEnd = frontmatterEnd

				// Skip up to 2 newlines after the frontmatter
				if (doc[removeEnd] === '\n' || doc[removeEnd] === '\r') removeEnd++
				if (doc[removeEnd] === '\n' || doc[removeEnd] === '\r') removeEnd++

				editorUtils.dispatch({
					changes: { from: frontmatterStart, to: removeEnd, insert: '' },
				})
				return true
			}

			// If no frontmatter exists, return true (nothing to remove)
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
		// Reactive properties
		frontmatter, // Reactive computed frontmatter data

		// Methods
        getFrontmatter,
        updateFrontmatterProperties,
		setFrontmatterProperties,
		clearFrontmatter,
        addFrontmatterProperty,
        removeFrontmatterProperty,
    }
}
