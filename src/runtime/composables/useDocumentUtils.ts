import { useAlfaaz } from './useAlfaaz'
import { markdown } from '@codemirror/lang-markdown'
import { GFM, type MarkdownExtension } from '@lezer/markdown'
import { CustomOFM } from '../editor/lezer-parsers/customOFMParsers'
import { type TocEntry } from '../editor/types/editor-types'

export function useDocumentUtils() {
	const alfaaz = useAlfaaz()

	function getWordCount(text: string) {
		return alfaaz.countWords(text)
	}

	function getLineCount(text: string) {
		return alfaaz.countLines(text)
	}

	function getCharacters(text: string) {
		return text.length;
	}

	function getReadingTime(text: string, wordsPerMinute = 200) {
		const wordCount = alfaaz.countWords(text)
		return Math.ceil(wordCount / wordsPerMinute);
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

	function getTableOfContents(text: string): TocEntry[] {
		const toc: TocEntry[] = [];
		if (!text) return toc;

		const tree = markdown({
			extensions: [GFM, CustomOFM as MarkdownExtension[], { remove: ['SetextHeading'] }],
		}).language.parser.parse(text);

		tree.iterate({
			enter: (node) => {
				if (node.name.startsWith('ATXHeading')) {
					const levelMatch = node.name.match(/ATXHeading(\d)/);
					if (levelMatch && levelMatch[1]) {
						const level = parseInt(levelMatch[1], 10);
						const headerMark = node.node.getChild('HeaderMark');
						if (headerMark) {
							const from = headerMark.to + 1;
							const to = node.to;
							const textContent = text.slice(from, to).trim();

							toc.push({
								level,
								text: textContent,
							});
						}
					}
				}
			},
		});

		return toc;
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
	}
}
