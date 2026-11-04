import { countWords, countLines } from 'alfaaz'
import { parseMarkdownToAST } from '../utils/markdownParser'
import { Text } from '@codemirror/state'
import { headingsOf, type Heading } from '../kit/headings'

export function useDocumentUtils() {
	function getWordCount(text: string) {
		return countWords(text)
	}

	function getLineCount(text: string) {
		return countLines(text)
	}

	function getCharacters(text: string) {
		return text.length;
	}

	function getReadingTime(text: string, wordsPerMinute = 200) {
		return Math.ceil(countWords(text) / wordsPerMinute);
	}

	function getParagraphs(text: string) {
		return text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
	}

	function getAvgWordLength(text: string) {
		const words = text.match(/\b\w+\b/g) || [];
		if (words.length === 0) return 0;
		const totalChars = words.reduce((sum, word) => sum + word.length, 0);
		return totalChars / words.length;
	}

	function isEmpty(text: string) {
		return text.trim().length === 0;
	}

	/** Top-level headings of a markdown string (same as the editor's `headingsField`). */
	function getTableOfContents(text: string): Heading[] {
		return headingsOf(parseMarkdownToAST(text), Text.of(text.split('\n')))
	}

	function getAllTags(text: string): string[] {
		const tags: string[] = [];
		if (!text) return tags;

		const tree = parseMarkdownToAST(text);

		let frontmatterEnd = 0;
		const frontmatterNode = tree.topNode.firstChild;
		if (frontmatterNode && frontmatterNode.name === 'Frontmatter') {
			frontmatterEnd = frontmatterNode.to;
		}

		tree.iterate({
			from: frontmatterEnd,
			enter: (node) => {
				if (node.name === 'Hashtag') {
					const tagText = text.slice(node.from + 1, node.to);
					if (tagText) {
						tags.push(tagText);
					}
				}
			},
		});

		return [...new Set(tags)];
	}

	return {
		getWordCount,
		getLineCount,
		getCharacters,
		getReadingTime,
		getParagraphs,
		getAvgWordLength,
		isEmpty,
		getTableOfContents,
		getAllTags,
	}
}
