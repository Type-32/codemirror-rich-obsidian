import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import {lezerHighlightHashtagTag} from "../lezer-parsers/lezerHashtagParser";
import {
    lezerHighlightEmbed, lezerHighlightEmbedMark, lezerHighlightInternalDisplay,
    lezerHighlightInternalLink,
    lezerHighlightInternalMark, lezerHighlightInternalPath, lezerHighlightInternalSubpath
} from "../lezer-parsers/lezerInternalLinkParser";
import {
    lezerHighlightYamlContent,
    lezerHighlightYamlFrontmatter,
    lezerHighlightYamlMarker
} from "../lezer-parsers/lezerYamlFrontmatterParser";
import {
    lezerHighlightLatex, lezerHighlightLatexBlock,
    lezerHighlightLatexInline,
    lezerHighlightLatexMarker
} from "../lezer-parsers/lezerLatexParser";
import {lezerHighlightIndentation} from "../lezer-parsers/lezerIndentationParser";

export default HighlightStyle.define([
    { tag: t.heading1, class: 'cm-heading cm-heading-1', textDecoration: 'none' },
    { tag: t.heading2, class: 'cm-heading cm-heading-2', textDecoration: 'none' },
    { tag: t.heading3, class: 'cm-heading cm-heading-3', textDecoration: 'none' },
    { tag: t.heading4, class: 'cm-heading cm-heading-4', textDecoration: 'none' },
    { tag: t.link, class: 'cm-link' },
    { tag: t.url, class: 'cm-link' },
    { tag: t.emphasis, class: 'cm-emphasis' },
    { tag: t.strong, class: 'cm-strong' },
    { tag: t.monospace, class: 'cm-mono' },
    // { tag: t.content, class: 'cm-content' },
    { tag: t.meta, class: 'cm-meta' },
    { tag: t.strikethrough, class: 'cm-strikethrough' },
    { tag: t.contentSeparator, class: 'cm-horizontal-rule' },
	{ tag: t.escape, class: 'cm-escape' },
    // { tag: lezerHighlightHashtagTag, class: 'cm-hashtag' },

    { tag: lezerHighlightEmbed, class: 'cm-embed' },
    { tag: lezerHighlightEmbedMark, class: 'cm-embed-mark cm-meta' },
    { tag: lezerHighlightInternalLink, class: 'cm-internal-link' },
    { tag: lezerHighlightInternalMark, class: 'cm-internal-link-mark cm-meta' },
    { tag: lezerHighlightInternalPath, class: 'cm-internal-link-path' },
    { tag: lezerHighlightInternalSubpath, class: 'cm-internal-link-subpath' },
    { tag: lezerHighlightInternalDisplay, class: 'cm-internal-link-display' },

    { tag: lezerHighlightYamlFrontmatter, class: 'cm-yaml-frontmatter cm-meta' },
    { tag: lezerHighlightYamlMarker, class: 'cm-yaml-marker cm-meta' },
    { tag: lezerHighlightYamlContent, class: 'cm-yaml-content cm-meta' },

    { tag: lezerHighlightLatexBlock, class: 'cm-tex-block cm-mono' }, // Style block math
    { tag: lezerHighlightLatexInline, class: 'cm-tex-inline cm-mono' },// Style inline math
    { tag: lezerHighlightLatexMarker, class: 'cm-tex-marker cm-meta' }, // Style "$" or "$$"
    { tag: lezerHighlightIndentation, class: 'cm-indent' },
]);
