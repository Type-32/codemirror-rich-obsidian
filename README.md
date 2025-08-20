# CodeMirror 6 WYSIWYG OFM Editor

## Credits and References, first of all
### Primary Credits
- https://github.com/erykwalder/lezer-markdown-obsidian, for OFM Lezer Parsers.
- https://github.com/surmon-china/vue-codemirror, for CodeMirror component in Vue.
- https://github.com/segphault/codemirror-rich-markdoc, for the foundation of this entire project.
- https://github.com/escwxyz/remark-obsidian-callout, for his awesome markdown-to-html callouts remark plugin

### Related References & Resources
- https://github.com/heavycircle/remark-obsidian
- https://github.com/flowershow/remark-wiki-link
- https://github.com/CTRL-Neo-Studios/simple-markdown-editor, my initial trial that quickly degraded into a shitslop because of overuse of AI
- https://github.com/nothingislost/obsidian-codemirror-options

## Disclaimer
I have used Gemini 2.5 Pro in the process of developing this editor numerous times, so do expect errors or inconsistencies in some parts of the code.

## Introduction
Do I even need an intro?

This is a CodeMirror 6 WYSIWYG Obsidian-Flavored Markdown Editor project that aims to recreate Obsidian's implementation of a WYSIWYG Markdown editor in CodeMirror 6.

That being said, please do note that:
- This is more of a synthesized project from multiple different projects, as you can see from the credits section
- The CodeMirror implementation is not a one-on-one replica. Since we don't have access to Obsidian's AST, we don't know how they parse markdown into node-marks and decorating them with CodeMirror. We could only try to imitate how they parse and decorate their markdowns judging from the class styling in their raw HTML.
- When using this editor, you may feel that some small user experiences does not mach the UX of Obsidian's markdown editor. Yes, this is a known issue, and we're trying to "fix" them.

## Known Issues
- In Obsidian, the hidden marks of nodes are revealed at mouse-up, whereas in this implementation, they're revealed at mouse-down.
- The editor errs when trying to parse nested callouts, to the extent where you might loose your data.
- Ordered List sequencing is different than that of Obsidian. We think that they probably use a sort of counter to keep track of lists of the same level beneath the hood, but we don't know for sure.
- Indents are currently tabs. In Obsidian, they seem to be parsed as nodes judging from their raw HTML. We suspect that this node may be accounted for some of the weird fuckery with leveled list, but we don't know for sure.
- Task lists doesn't work for now.
- (Not much of an issue but still kept track of) YAML Frontmatter is parsed as raw text instead of TOML. We're currently determining whether to leave this as it is or try to add our own implementation to imitate how Obsidian parses and modifies their markdown files' Frontmatter.
- Support for embedded videos, notes, bases, and canvases are currently lacking. Though we already have the foundational framework done to implement these.
- Support for code-block mermaid graph rendering is lacking.
- Support for code-block bases is lacking.
- Light/Dark themes are not yet supported in code-block syntax highlighting.