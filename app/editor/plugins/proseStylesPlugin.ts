import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import {lezerHighlightHashtag} from "~/editor/lezer-parsers/lezerHashtagParser";

export default HighlightStyle.define([
    { tag: t.heading1, class: 'cm-heading cm-heading-1', textDecoration: 'none' },
    { tag: t.heading2, class: 'cm-heading cm-heading-2', textDecoration: 'none' },
    { tag: t.heading3, class: 'cm-heading cm-heading-3', textDecoration: 'none' },
    { tag: t.heading4, class: 'cm-heading cm-heading-4', textDecoration: 'none' },
    { tag: t.link, class: 'cm-link' },
    { tag: t.emphasis, class: 'cm-emphasis' },
    { tag: t.strong, class: 'cm-strong' },
    { tag: t.monospace, class: 'cm-mono' },
    { tag: t.content, class: 'cm-content' },
    { tag: t.meta, class: 'cm-meta' },
    { tag: t.strikethrough, class: 'cm-strikethrough' },
    { tag: lezerHighlightHashtag, class: 'cm-hashtag' },
]);