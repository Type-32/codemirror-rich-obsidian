# CodeMirror 6 WYSIWYG OFM Editor

## Credits and References, first of all
### Primary Credits
- https://github.com/segphault/codemirror-rich-markdoc, **_for the foundation of this entire project._**
- https://github.com/erykwalder/lezer-markdown-obsidian, for OFM Lezer Parsers.
- https://github.com/surmon-china/vue-codemirror, for the CodeMirror 6 component in Vue.
- https://github.com/ebullient/markdown-it-obsidian-callouts, for his awesome markdown-to-html callouts markdown-it plugin
- https://github.com/mgmeyers/obsidian-indentation-guides, for indentation guides
- Markdown-It
- https://github.com/thecodrr/alfaaz, for insanely fast word/line-counting functions
- https://github.com/yuri2peter/codemirror-ai-enhancer, for providing the simple AI completion editing experience

### Related References & Resources
- https://github.com/heavycircle/remark-obsidian, for mostly wiki link alias & highlights & callouts parsing
- https://github.com/flowershow/remark-wiki-link, for wiki link parsing
- https://github.com/CTRL-Neo-Studios/simple-markdown-editor, my initial trial that quickly degraded into a shitslop because of overuse of AI
- https://github.com/nothingislost/obsidian-codemirror-options
- https://github.com/nothingislost/obsidian-cm6-attributes

## Disclaimer
I have used DeepSeek V4 Pro + Claude Opus 5 + Claude Sonnet 5 in the process of developing this editor numerous times, so do expect errors or inconsistencies in some parts of the code.

## Introduction
Do I even need an intro?

This is a CodeMirror 6 WYSIWYG Obsidian-Flavored Markdown Editor project that aims to recreate Obsidian's implementation of a WYSIWYG Markdown editor in CodeMirror 6.

That being said, please do note that:
- This is more of a synthesized project from multiple different projects, as you can see from the credits section
- The CodeMirror implementation is not a one-on-one replica. Since we don't have access to Obsidian's AST, we don't know how they parse markdown into node-marks and decorating them with CodeMirror. We could only try to imitate how they parse and decorate their markdowns judging from the class styling in their raw HTML.
- When using this editor, you may feel that some small user experiences does not mach the UX of Obsidian's markdown editor. Yes, this is a known issue, and we're trying to "fix" them.

## Installation

Run with your preferred package manager:
```shell
bun add @type32/codemirror-rich-obsidian-editor
```

Add module in Nuxt Config:

```ts
export default defineNuxtConfig({
	// Your config...
	modules: [
		// Your other modules...
		'@type32/codemirror-rich-obsidian-editor',
	],
})
```

Customize the editor fonts:

```css
@import 'tailwindcss';
@import '@nuxt/ui';

@theme static {
	/* Your Config Here... */
	
	--font-sans: /* Your Config Here... */;

	--font-editor: 'SF Pro Display', 'Segoe UI Variable Static Display', var(--font-sans, sans-serif);

	--font-editor-code: 'Google Sans Code', 'JetBrains Mono', 'Consolas', var(--font-mono, ui-monospace);

	/* List indentation / spacing.
	   UL and OL have independent step / gap pairs so ordered lists can be
	   tuned to a tighter or wider nesting than unordered lists.

	     --ul-nesting-step: horizontal distance added per nesting level (UL).
	     --ul-bullet-gap:   width of the `•` bullet slot (also the visual gap
	                        between bullet and content text).
	     --ol-nesting-step: horizontal distance added per nesting level (OL).
	     --ol-bullet-gap:   reserved slot width for the `1.` / `2.` marker
	                        (and visual gap between marker and content).
	                        Should be wide enough to hold the largest marker
	                        you expect (default 1.5rem fits up to 3 digits).
	     --list-base-offset: shared editor-frame left-padding baseline. */
	--ul-nesting-step: 1.5rem;
	--ul-bullet-gap:   0.25rem;

	--ol-nesting-step: 1rem;
	--ol-bullet-gap:   0.5rem;

	--list-base-offset: 1rem;

	/* Indent-guide styling for list lines. See `.cm-list-line-ul` / `.cm-list-line-ol` below. */
	--list-guide-color: var(--ui-primary);
	--list-guide-width: 1px;
	--list-guide-opacity: 0.05;

	/* Active indent-guide styling — the guide stripe belonging to the
	   current cursor's ancestor group is highlighted on all sibling lines.
	   See `.cm-list-line-active-guide` below. */
	--list-active-guide-color: var(--ui-primary);
	--list-active-guide-opacity: 1;

	--indent-level: 0;

	/* Your Config Here... */
}
```

## Known Issues
- Ordered List sequencing is different than that of Obsidian. We think that they probably use a sort of counter to keep track of lists of the same level beneath the hood, but we don't know for sure.
- Light/Dark themes are not yet supported in code-block syntax highlighting.
- Nested callouts render as a styled blockquote (source visible) instead of a callout widget: `markdown-it-obsidian-callouts` mis-renders nesting, and the old whole-block widget could corrupt the document on edit. Regular callouts render as before.
- Tables are widget-only: the markdown source is never shown. Click a cell to edit (Enter/blur commits, Esc cancels); right-click for a Nuxt UI context menu with insert/delete row & column, alignment, clear cell; drag the `⋮⋮` handles to reorder rows/columns. Malformed tables (bad delimiter row) fall back to plain text so they can be repaired.

### Resolved
- ~~Rendered block replacement recomputes all regions on every operation.~~ Every prose plugin now goes through `createProsePlugin`: inline decorations are viewport-scoped and patch only changed lines; block decorations rebuild only when the selection actually crosses one of the plugin's nodes.
- ~~Marks reveal on `mousedown`; Obsidian reveals on `mouseup`.~~ Decoration rebuilds are suspended while drag-selecting and run once on release.
- ~~Nested callouts can lose data.~~ See above.
- ~~Tables don't render.~~ See above.
- ~~Indents are tabs / list indents are a pain.~~ Indent guides and active-guide highlighting work; the guide-level off-by-one is fixed.
- ~~Task lists don't work.~~ Working.
- ~~Embedded videos/notes/canvases unsupported~~ — `internalLinkMap` lets hosts map links to their own embed components.
- ~~Mermaid/bases code blocks unsupported~~ — `specialCodeBlockMap` lets hosts map a code-fence language to their own component.
- ~~YAML Frontmatter parsed as raw text~~ — deliberately left raw; `useEditorFrontmatter` offers get/set/clear helpers for hosts that want them.

## Contributions
- To anyone who wants to fork this, **make sure you preserve the original credits and references to the libraries that are used in this project. It means a lot to them and to us.**
- To anyone who wants to fork this project into another framework - such as React, Angular, Svelte, or PHP - **best of luck. We don't have react/solidjs/Angular/Svelte/PHP developers on the team so we can't help with that. This project is developed is mostly just Vue/Nuxt in mind.**

PS: You may notice some inconsistencies in the use of pronouns in the README.md: it's not written using AI. It's just my weird writing style.
