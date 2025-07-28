import {Decoration} from "@codemirror/view";

export const decorationHidden = Decoration.replace({class: 'cm-obsidian-hidden cm-obsidian'});
export const decorationBullet = Decoration.mark({class: 'cm-obsidian-bullet cm-obsidian'});
export const decorationCode = Decoration.mark({class: 'cm-obsidian-code cm-obsidian'});
export const decorationTag = Decoration.mark({class: 'cm-obsidian-tag cm-obsidian'});

// The reason that I have a separate decoration for a hashtag is because the hashtag component node's styling has to be inline, which somehow
// using a lezer-highlight doesn't do the job. It's weird af.
export const decorationProseHashtag = Decoration.mark({class: 'cm-hashtag', tagName: 'span'})