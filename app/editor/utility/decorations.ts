import {Decoration} from "@codemirror/view";

export const decorationHidden = Decoration.replace({class: 'cm-obsidian-hidden cm-obsidian', tagName: 'span'});
export const decorationBullet = Decoration.mark({class: 'cm-obsidian-bullet cm-obsidian'});
export const decorationCode = Decoration.mark({class: 'cm-obsidian-code cm-obsidian'});
export const decorationTag = Decoration.mark({class: 'cm-obsidian-tag cm-obsidian'});

// The reason that I have a separate decoration for a hashtag is because the hashtag component node's styling has to be inline, which somehow
// using a lezer-highlight doesn't do the job. It's weird af.
export const decorationProseHashtag = Decoration.mark({class: 'cm-hashtag', tagName: 'span'})
export const decorationProseInternalLink = Decoration.mark({class: 'cm-internal-link', tagName: 'span'})
export const decorationProseInternalPath = Decoration.replace({class: 'cm-internal-link-path', tagName: 'span'})
export const decorationProseInternalSubpath = Decoration.replace({class: 'cm-internal-link-subpath', tagName: 'span'})