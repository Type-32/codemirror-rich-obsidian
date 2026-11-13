# What's new in 0.4 (since 0.3.9)

0.4 is about Obsidian parity: the editor should behave like Obsidian's Live Preview, not only look like it. Each change below was checked against Obsidian 1.12 on the same notes.

## Breaking changes

- **Syntax colours come from CSS.** The editor no longer adds CodeMirror's `defaultHighlightStyle`.
  - Bold, italic, strikethrough and heading weight now come from the `.cm-strong`, `.cm-emphasis`, `.cm-strikethrough` and `.cm-heading` rules in `editor.css`.
  - Code tokens get `cm-code-*` classes coloured by `--code-*` variables (see [Code blocks](#code-blocks)).
  - If you styled the generated `ͼ…` classes, move those rules to the new classes.
- **Task markup changed.**
  - Every task line has `.cm-task-line[data-task="<status>"]`; `.cm-task-checked` is gone.
  - The checkbox has `data-task="<status>"`. `data-special` and the status character drawn inside the box are gone.
  - Statuses other than a space now render checked.
- **`wysiwyg({ lezer: { codeLanguages } })` takes what `@codemirror/lang-markdown` takes:** a `LanguageDescription[]`, or a function returning a `Language` or `LanguageDescription`. The default is `@codemirror/language-data`'s list.
- **Stricter callouts.** `> [!note]Title` (no space after `]`) and a `[!note]` that isn't at the start of the quote's first line are plain quotes now, as in Obsidian.
- **The `Indentation` syntax node is gone.** Leading tabs are still wrapped in one `.cm-indent` span each.
- **List geometry variables replaced** by Obsidian's names (see [Lists and indentation](#lists-and-indentation)).
  - Removed: `--ul-nesting-step`, `--ul-bullet-gap`, `--ol-nesting-step`, `--ol-bullet-gap`, `--list-base-offset`, `--list-guide-*`, `--list-active-guide-*`, `--indent-level`.
  - The `.cm-list-line-active-guide*` classes and their `--active-guide-index` style are gone. The active guide is `.cm-indent-group .cm-active-indent`, as for any indented line.
- **List mark markup changed.**
  - `.cm-list-formatting` now covers just the mark (`-`, `1.`), not the space after it.
  - Bullets also get `.cm-list-bullet`.
  - List lines no longer get padding from CSS. Their hanging indent is set per line through `--hang-padding` and `--hang-indent`.

## Code blocks

- **Fenced code is highlighted now.** The language from the info string (`js`, `python`, `css`…) is loaded on demand. Previously no code block was highlighted at all.
- **The palette is plain CSS, using Obsidian's variable names:** `--code-normal`, `--code-comment`, `--code-function`, `--code-important`, `--code-keyword`, `--code-operator`, `--code-property`, `--code-punctuation`, `--code-string`, `--code-tag`, `--code-value`. Set light colours on `:root` and dark ones on `.dark`.
- **Code text no longer gets the inline-code pill style.**

## Tasks

- **Any single character is a status:** `- [/]`, `- [-]`, `- [>]`, `- [?]`… It must be followed by a space or tab, so `- [ ]text` is not a task.
- **Every status but a space is checked.** Only `x`/`X` are struck through. Clicking a checked box clears it.
- **A revealed `[ ]` is dimmed** like other formatting.

## Callouts

- **`[!type|metadata]`:** `data-callout` holds the type and `data-callout-metadata` the rest, so `[!note|wide]` gets the note styling.

## Lists and indentation

- **Revealing a mark never moves text.**
  - A bullet keeps its `-` in the line, made transparent, with the dot drawn over it.
  - It reveals only while the cursor is on the `-` itself, not after the space, as in Obsidian.
  - Numbers stay as typed.
- **Wrapped lines line up with the text** after a bullet, number, checkbox, quote marker or leading tab, including `10.` and deeper levels. Lines continuing a list item (lazy or indented) wrap at the item's text.
- **One indent level is one fixed width** (`--list-indent`, default `2.25em`), for list nesting and tab-indented lines alike. Each level draws one guide, placed under the parent's bullet.
- **Tabs after quote markers** (`> \t- item`) get indent levels and guides too.
- **New variables (Obsidian's names):**
  - `--list-indent`, `--list-padding-inline-start`, `--list-marker-color`, `--list-bullet-size`, `--list-bullet-radius`;
  - `--checkbox-size`, `--checkbox-radius`, `--checkbox-margin-inline-start`, `--checkbox-margin-inline-end`, `--checkbox-color`, `--checkbox-border-color`, `--checkbox-marker-color`;
  - `--indentation-guide-width`, `--indentation-guide-width-active`, `--indentation-guide-color`, `--indentation-guide-color-active`, `--indentation-guide-editing-indent`.
- **One `.cm-indent` span per leading tab.** Lines in a paragraph that start with a tab used to get two nested spans.
