import type { Component } from 'vue'
import type { LanguageSupport } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'

/**
 * Represents a resolvable internal link within the editor.
 * This is used to provide autocompletion and to resolve link targets.
 */
export interface InternalLink {
	/**
	 * The display name of the link.
	 * This is what appears in the autocompletion list and is used as the default link text.
	 * It should be unique if `filePath` is not provided.
	 */
	name: string;
	/**
	 * An optional file path associated with the link.
	 * Used to disambiguate links that have the same `name`.
	 * When autocompleting a link with a duplicate name, this path is used as the link target.
	 */
	filePath?: string;
	/**
	 * A unique identifier for the internal link.
	 * This value has no direct effect on the editor's behavior but is passed through
	 * to click events, allowing developers to use it for their own logic (e.g., routing).
	 */
	referenceId: string;
	/**
	 * An optional Vue component to render when this link is embedded (e.g., `![[link]]`).
	 * If not provided, embeds of this link will be rendered as standard links.
	 */
	embedComponent?: Component;
	/**
	 * An optional parameter to pass alongside into the component as the prop.
	 */
	componentProps?: Record<string, any>
}

export interface InternalLinkNode {
	path: string
	subpath?: string
	display?: string
}

/**
 * Details about a clicked internal link.
 * This object is emitted as the payload of the `internal-link-click` event.
 */
export interface InternalLinkClickDetail {
	/**
	 * The target of the link as specified in the markdown source.
	 * This corresponds to the `path` part in `[[path#subpath|display]]`.
	 * It can be either the `name` or `filePath` of an `InternalLink`.
	 */
	target: string;
	/** The subpath of the link, if any. Corresponds to the `#subpath` part. */
	subpath?: string;
	/** The display text (alias) of the link, if any. Corresponds to the `|display` part. */
	display?: string;
	/** The type of interaction, either a direct link click or an embed. */
	type: 'embed' | 'internal-link';
	/**
	 * The unique identifier (`referenceId`) of the resolved `InternalLink`.
	 * This allows developers to identify which link was clicked, even if multiple links
	 * share the same name or file path.
	 */
	referenceId?: string;
}

export interface ExternalLinkClickDetail {
    url: string;
    text: string | null;
}

export interface SpecialCodeBlockMapping {
    codeInfo: string
    component: Component
}

export type WysiwygPlugin = {
  lezer?: {
      codeLanguages?: (info: string) => LanguageSupport | Promise<LanguageSupport> | null
      [key: string]: any
  }
}

export type Frontmatter<T extends object = {}> = {
    title?: string;
    description?: string;
    date?: Date;
    draft?: boolean;
    tags?: string[];
    categories?: string[];
    image?: string;
    slug?: string;
    [key: string]: any;
} & T

export type UnicodeRange = number[][]

export interface TocEntry {
	level: number
	text: string,
    node: SyntaxNode
}

export interface SearchMatch {
	from: number;
	to: number;
}

export interface SearchOptions {
	query: string;
	caseSensitive?: boolean;
}
