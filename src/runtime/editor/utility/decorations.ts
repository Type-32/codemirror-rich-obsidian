import {Decoration} from "@codemirror/view";

export const decorationHidden = Decoration.replace({class: 'cm-obsidian-hidden cm-obsidian', tagName: 'span'});

// The reason that I have a separate decoration for a hashtag is because the hashtag component node's styling has to be inline, which somehow
// using a lezer-highlight doesn't do the job. It's weird af.
export const decorationProseHashtag = Decoration.mark({class: 'cm-hashtag', tagName: 'span'})