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
I have used Gemini 2.5 Pro + Gemini 3 Pro Preview + Claude Sonnet 4.5 + Claude Sonnet 4.6 in the process of developing this editor numerous times, so do expect errors or inconsistencies in some parts of the code.

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

	--list-indent: 1.5rem;

	--indent-level: 0;

	/* Your Config Here... */
}
```

## Known Issues
- Same as `segphault/codemirror-rich-markdoc`, the rendered block replacement code is not yet optimized, so it recomputes all of the replaced regions on every operation instead of only updating them as needed.
  - Progress is being made on this issue: we've optimized the Rich Text Plugin to update based on only the updated ranges instead of the entire document.
- In Obsidian, the hidden marks of nodes are revealed at `mouseup`, whereas in this implementation, they're revealed at `mousedown`.
- The editor errs when trying to parse nested callouts, to the extent where you might loose your data.
  - Regular Callouts works fine.
- Ordered List sequencing is different than that of Obsidian. We think that they probably use a sort of counter to keep track of lists of the same level beneath the hood, but we don't know for sure.
  - It might be how CodeMirror keeps track of tabs in lists. The issue is not being worked on right now.
- ~~Indents are currently tabs. In Obsidian, they seem to be parsed as nodes judging from their raw HTML. We suspect that this node may be accounted for some of the weird fuckery with leveled list, but we don't know for sure.~~
  - We've implemented `mgmeyers/obsidian-indentation-guides` for indentation styling. Indents doesn't seem to be nodes.
- ~~Task lists doesn't work for now.~~
  - Task lists are working, but customization is sparse.
- List indents are a pain.
- ~~(Not much of an issue but still kept track of) YAML Frontmatter is parsed as raw text instead of TOML. We're currently determining whether to leave this as it is or try to add our own implementation to imitate how Obsidian parses and modifies their markdown files' Frontmatter.~~
  - **We've decided to leave it alone for people who want to implement their own YAML Frontmatter parsing logic.**
- ~~Support for embedded videos, notes, bases, and canvases are currently lacking~~
  - We have a mapping prop that allows developers to add their own link-to-file implementations. (Specific to Vue/Nuxt)
- ~~Support for code-block mermaid graph rendering & bases is lacking.~~
  - We have a mapping prop that allows developers to add their own custom codeblock widgets. (Specific to Vue/Nuxt)
- Light/Dark themes are not yet supported in code-block syntax highlighting.

## Contributions
- To anyone who wants to fork this, **make sure you preserve the original credits and references to the libraries that are used in this project. It means a lot to them and to us.**
- To anyone who wants to fork this project into another framework - such as React, Angular, Svelte, or PHP - **best of luck. We don't have react/solidjs/Angular/Svelte/PHP developers on the team so we can't help with that. This project is developed is mostly just Vue/Nuxt in mind.**

PS: You may notice some inconsistencies in the use of pronouns in the README.md: it's not written using AI. It's just my weird writing style.
