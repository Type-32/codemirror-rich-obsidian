import { countWords, countLines } from "alfaaz";

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
		const wordCount = countWords(text);
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

	return {
		getWordCount,
		getLineCount,
		getCharacters,
		getReadingTime,
		getParagraphs,
		getAvgWordLength,
		isEmpty
	}
}
