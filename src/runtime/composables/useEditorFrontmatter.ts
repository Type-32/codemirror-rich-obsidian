import { type Ref } from 'vue'
import { dump } from 'js-yaml'
import { useEditorUtils } from './useEditorUtils'
import { parseFrontmatter } from '../utils/frontmatter'
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
    function updateFrontmatterProperties(properties: Partial<T>) {
		try {
			const doc = editorUtils.getDoc() || ''
			const ast = editorUtils.parseMarkdownToAST(doc)
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
			console.log(e)
			return false;
		}
    }

	/**
	 * Sets frontmatter properties, replacing all existing frontmatter.
	 * If properties object is empty or all values are undefined, removes frontmatter entirely.
	 */
	function setFrontmatterProperties(properties: Partial<T>) {
		try {
			const doc = editorUtils.getDoc() || ''
			const ast = editorUtils.parseMarkdownToAST(doc)
			const firstNode = ast.topNode.firstChild

			let frontmatterNodeRange = { from: -1, to: -1 }

			// Check for both possible frontmatter node names
			if (firstNode && (firstNode.name === 'Frontmatter' || firstNode.name === 'YAMLFrontMatter')) {
				frontmatterNodeRange = { from: firstNode.from, to: firstNode.to }
				const { error } = getFrontmatter()
				if (error) return false;
			}

			// Clean up undefined values
			const newData: Partial<T> & Record<string, any> = { ...properties }
			Object.keys(newData).forEach(key => {
				if (newData[key] === undefined) {
					delete newData[key]
				}
			})

			// Check if there's any content to write
			const hasContent = Object.keys(newData).length > 0

			if (!hasContent) {
				// Remove frontmatter entirely if no properties
				if (frontmatterNodeRange.from !== -1) {
					// Remove existing frontmatter block and any trailing newlines
					const endPos = frontmatterNodeRange.to
					let removeEnd = endPos

					// Skip up to 2 newlines after the frontmatter
					if (doc[endPos] === '\n') removeEnd++
					if (doc[endPos + 1] === '\n') removeEnd++

					editorUtils.dispatch({
						changes: { from: frontmatterNodeRange.from, to: removeEnd, insert: '' },
					})
				}
				// If no frontmatter exists and no content, do nothing
				return false;
			}

			// Generate YAML content
			const newYamlContent = dump(newData, { skipInvalid: true }).trim()
			const newFrontmatterBlock = `---\n${newYamlContent}\n---`

			if (frontmatterNodeRange.from !== -1) {
				// Replace existing frontmatter
				editorUtils.dispatch({
					changes: {
						from: frontmatterNodeRange.from,
						to: frontmatterNodeRange.to,
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

			return true;
		} catch (e) {
			console.log(e)
			return false;
		}
	}

	/**
	 * Completely removes the frontmatter from the document if it exists.
	 * Includes the YAML delimiters and any trailing newlines.
	 */
	function clearFrontmatter() {
		try {
			const doc = editorUtils.getDoc() || ''
			const ast = editorUtils.parseMarkdownToAST(doc)
			const firstNode = ast.topNode.firstChild

			// Check if frontmatter exists
			if (firstNode && (firstNode.name === 'Frontmatter' || firstNode.name === 'YAMLFrontMatter')) {
				const endPos = firstNode.to
				let removeEnd = endPos

				// Skip up to 2 newlines after the frontmatter
				if (doc[endPos] === '\n') removeEnd++
				if (doc[endPos + 1] === '\n') removeEnd++

				editorUtils.dispatch({
					changes: { from: firstNode.from, to: removeEnd, insert: '' },
				})
			}

			return true;
		} catch (e) {
			console.log(e)
			return false;
		}
		// If no frontmatter exists, do nothing
	}

    function addFrontmatterProperty(key: string, value: any) {
        updateFrontmatterProperties({ [key]: value } as Partial<T>)
    }

    function removeFrontmatterProperty(key: string) {
        updateFrontmatterProperties({ [key]: undefined } as Partial<T>)
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
