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
- **List keys behave like Obsidian's.** `@codemirror/lang-markdown`'s keymap is no longer installed (see [List editing](#list-editing)).
  - Backspace at the start of an item's text deletes a character instead of removing the mark.
  - Enter on an empty item ends the list at once, instead of first making it loose.
  - Enter in a loose list doesn't add a blank line.
- **Ordered lists are renumbered as you edit.** Turn it off with `listRenumbering.of(false)`.
- **Code block CSS changed.** Block lines use `--code-background`, `--code-border-*`, `--code-radius` and `--code-size` instead of fixed Tailwind utilities, and code text is no longer semibold. Inline code (`.cm-mono`) uses the same variables.
- **Callout markup changed.** A callout is now `div.cm-callout-widget.callout`, built from `.callout-title` (`.callout-title-icon`, `.callout-title-inner`, `.callout-fold`, `.edit-block-button`) and `.callout-content`.
  - The title and body hold read-only CodeMirror editors.
  - Folding uses `.is-collapsible` and `.is-collapsed` instead of `<details>` and `[open]`.
  - `markdown-it-obsidian-callouts` is no longer a dependency.
- **Read-only editors never reveal source.** `selectionTouches` and `selectionWithin` (from `/kit`) now return false in a non-editable view, so a `disabled` editor always shows rendered markdown.
- **Tables look and are built like Obsidian's.**
  - Cells are nested editors: `.cm-table-cell > .cm-table-cell-content > .cm-editor`, instead of `contenteditable` cells holding markdown-it HTML.
  - The header sits on the page, bold and aligned to the start. The body is one rounded box with inner lines.
  - Drag handles (`.cm-table-handle.cm-table-col-handle` / `.cm-table-row-handle`) are bars above the hovered cell's column and left of its row, not an extra row and column with `.cm-table-corner`.
  - `markdown-it` is no longer a dependency.
- **Frontmatter shows as a properties panel by default.** Pass `:properties="false"` to `<Editor>` to keep the raw YAML.
  - While the panel is shown, typing can't edit the YAML behind it, and the cursor stays in the body.
  - Programmatic changes (`v-model`, `useEditorFrontmatter`, `view.dispatch` without a user event) still can.
- **`js-yaml` is replaced by `yaml`.**
  - `stringifyYaml` and `parseYaml` keep their signatures, but `stringifyYaml` no longer takes `skipInvalid`.
  - Unquoted dates such as `2026-11-13` now parse as strings, as in Obsidian.

## Properties (frontmatter)

Obsidian's Properties view, in the note.

- **Typing `---` as the first line of a note without properties starts them**, as in Obsidian: the note gets empty frontmatter and "Add property" opens. After you name a property, the cursor goes straight to its value, for every type.
- **Empty properties can be deleted:** with no properties, "Delete frontmatter" (`ui.properties.deleteFrontmatter`) sits right of "Add property" and removes the empty `---` block. Both buttons and "Add field" are Nuxt UI `sm` buttons.
- **Rows:** type icon (type menu and Remove), name (rename in place), value.
- **Value editors:**
  - Text, where `[[wikilinks]]` render as links and fire `internal-link-click`;
  - Number, Checkbox, Date, Date & time;
  - List, Tags and Aliases as pills;
  - nested objects as indented rows with "Add field". Obsidian doesn't support nested objects; we do.
- **The YAML keeps how it was written.** Edits rewrite only what changed: comments, key order, quoting and flow lists survive, and a renamed key stays where it was. Each edit is one undo step. Invalid YAML, or YAML that isn't a mapping, stays as source.
- **Keyboard, as in Obsidian:**
  - ↑ from the first line of the note goes to Add property;
  - ↑/↓/Tab move between rows; Enter edits a value with its text selected, then saves (Escape cancels);
  - Escape returns to the note.
- **Types are per property name, like Obsidian's `types.json`.** `properties.types` sets them and `onTypeChange` persists the user's choice. Unlisted keys are inferred (`tags`/`aliases` by name, lists, numbers, checkboxes, dates, objects).
- **Suggestions:** `keySuggestions` (names offered when adding) and `valueSuggestions(key)` (offered in list inputs).
- **Labels:** `ui.properties.*` keys in `editorLabels`.

## Code blocks

- **Fenced code is highlighted now.** The language from the info string (`js`, `python`, `css`…) is loaded on demand. Previously no code block was highlighted at all.
- **The palette is plain CSS, using Obsidian's variable names:** `--code-normal`, `--code-comment`, `--code-function`, `--code-important`, `--code-keyword`, `--code-operator`, `--code-property`, `--code-punctuation`, `--code-string`, `--code-tag`, `--code-value`. Set light colours on `:root` and dark ones on `.dark`.
- **Code text no longer gets the inline-code pill style.**
- **Revealing works like Obsidian's.** A cursor anywhere in the block shows both fences; before, each fence showed only while the cursor was on its own line. The language label hides while you edit, and the revealed language is dimmed.
- **The label shows the language's name** (`js` → JavaScript, `py` → Python), the raw tag for unknown languages, or a copy icon when there's none. Clicking copies the code.
- **An unclosed fence stays as source.** Before, its last line was hidden as if it were the closing fence.
- **New box variables:** `--code-background`, `--code-border-width`, `--code-border-color`, `--code-radius`, `--code-size`.

## Tasks

- **Any single character is a status:** `- [/]`, `- [-]`, `- [>]`, `- [?]`… It must be followed by a space or tab, so `- [ ]text` is not a task.
- **Every status but a space is checked.** Only `x`/`X` are struck through. Clicking a checked box clears it.
- **A revealed `[ ]` is dimmed** like other formatting.

## Callouts

- **Rendered by the editor itself.** The title and body are read-only copies of the editor (`nestedEditor`), so they render exactly like the note:
  - links, tags, `==highlights==`, math, tasks, lists, tables, highlighted code;
  - each source line on its own line (markdown-it used to join them);
  - nested callouts and quotes, which used to show as source.
- **Clicking a callout selects its whole source**, as in Obsidian. Links inside work as links, and the `</>` button puts the cursor at its start.
- **Folding:** `[!type]-` starts folded and `+` open. The chevron folds and unfolds without changing the note.
- **`[!type|metadata]`:** `data-callout` holds the type and `data-callout-metadata` the rest, so `[!note|wide]` gets the note styling.
- **Callouts inside list items render as callouts.** Obsidian shows them as code blocks; we deliberately don't copy that.
- **Icons follow Obsidian's defaults and aliases:** `summary`/`tldr`, `hint`/`important`, `check`/`done`, `help`/`faq`, `caution`/`attention`, `fail`/`missing`, `error`, `cite`.
- **Math in callouts:**
  - It renders once, inside the callout. It used to render a second time below it, with the `>` markers in the formula.
  - It renders inside plain quotes too, without their `>` markers.
  - Its lines keep the quote's indent while you edit them.

## Math

- **One-line `$$…$$` after `>` or list indentation now ends at its own closing `$$`.** It used to end two characters early (one per marker character), so typing math in a quote or callout showed a broken formula, in red, while the cursor was still in it.
- **Math source is highlighted** while the cursor is in it: commands, `^` `_` `&`, brackets, numbers and `%` comments, coloured by the code palette (`--code-*`).
- **Math source is plain monospace text** (`.cm-math`), like Obsidian's, instead of an inline-code pill.

## Lists and indentation

- **Revealing a mark never moves text.**
  - A bullet keeps its `-` in the line, made transparent, with the dot drawn over it.
  - It reveals only while the cursor is on the `-` itself, not after the space, as in Obsidian.
  - Numbers stay as typed.
- **Wrapped lines line up with the text** after a bullet, number, checkbox, quote marker or leading tab, including `10.` and deeper levels. Indented lines continuing a list item wrap at the item's text.
- **Lazy continuation lines sit at the margin**, as in Obsidian. These are lines after a list item that aren't indented (`- item` then `more text`); they used to be indented under the item.
- **Nested quotes draw one bar per level** (`> > text`), as in Obsidian. A nested level's `>` is `.cm-quote-border`.
- **One indent level is one fixed width** (`--list-indent`, default `2.25em`), for list nesting and tab-indented lines alike. Each level draws one guide, placed under the parent's bullet.
- **Tabs after quote markers** (`> \t- item`) get indent levels and guides too.
- **New variables (Obsidian's names):**
  - `--list-indent`, `--list-padding-inline-start`, `--list-marker-color`, `--list-bullet-size`, `--list-bullet-radius`;
  - `--checkbox-size`, `--checkbox-radius`, `--checkbox-margin-inline-start`, `--checkbox-margin-inline-end`, `--checkbox-color`, `--checkbox-border-color`, `--checkbox-marker-color`;
  - `--indentation-guide-width`, `--indentation-guide-width-active`, `--indentation-guide-color`, `--indentation-guide-color-active`, `--indentation-guide-editing-indent`.
- **One `.cm-indent` span per leading tab.** Lines in a paragraph that start with a tab used to get two nested spans.

## List editing

Checked key by key against Obsidian (32 cases), and covered by tests.

- **Enter** continues lists (next number, a fresh `[ ]` for tasks), quotes and callouts.
  - On an empty item, a nested one moves up a level and a top-level one ends the list.
  - An empty `> ` line ends the quote.
  - A line with only whitespace is cleared.
- **Shift-Enter** adds a line inside the item, indented to its text.
- **Tab / Shift-Tab** move an item with its children.
  - An ordered item takes the number of its new place (`1.` when it starts a sublist).
  - The first item of a list can't be indented.
  - In quotes the indentation goes after the `>`.
- **Renumbering:**
  - Every ordered list an edit touches is numbered in sequence from its first item, at each level.
  - Lists split only by blank lines, or by `.` vs `)`, count as one.
  - Undo reverts the edit and the renumbering together.
  - Undo/redo and programmatic changes (setting the document) never renumber.
- **For your own keymaps:** `insertListNewline`, `insertListContinuation`, `indentListItem`, `outdentListItem` and `listRenumbering` are exported from `/kit`.

## Tables

Checked key by key against Obsidian.

- **Cells render like the note.** Each cell is a copy of the editor (`nestedEditor`), so links, tags, highlights and math render in cells, and internal links fire `internal-link-click`. Previously markdown-it rendered cells, without wikilinks.
- **Live preview while you type in a cell.** A click puts the cursor where you clicked. Every keystroke goes straight into the cell's text in the source, without re-padding the table; undo works from inside the cell.
  - Typed or pasted `|` is written as `\|`, and line breaks become spaces, so a cell can't break the table.
  - The note's cursor follows the one in the cell.
- **Keyboard:**
  - Tab / Shift-Tab: next / previous cell, text selected. Tab in the last cell adds a row.
  - Enter: the cell below, text selected. Enter in the last row adds a row.
  - ↑/↓: the cell above/below, at the same x. Past the header or the last row: the line above/below the table.
  - ←/→ at a cell's start/end: the previous cell's end / the next cell's start, then out of the table.
  - Escape: the line below the table.
  - ↓ on the line above a table enters its first cell; ↑ on the line below enters its last row.
  - Backspace at the start of the line below a table selects the table (press again to delete it).
- **Read-only editors and callouts:** cells, the context menu and the drag handles don't edit. They used to change a disabled editor's table, and a table inside a callout without saving it to the note.
- **↑/↓ and clicks below a table land on the right line.** A vertical margin on the table used to throw CodeMirror's line positions off, so ↑ from the line below jumped over the table.
- **Add buttons:** `+` below the table adds a row and puts the cursor in it; `+` to its right adds a column (Obsidian's).
- **New variables:**
  - Obsidian's names: `--table-border-width`, `--table-border-color`, `--table-background` (body cells), `--table-text-size`, `--table-line-height`;
  - `--table-header-background`, `--table-header-border-color`, `--table-header-color`, `--table-header-weight`;
  - `--table-cell-vertical-alignment`, `--table-column-min-width`, `--table-column-max-width`;
  - `--table-drag-handle-size`, `--table-drag-handle-color`;
  - ours: `--table-radius` (the body's corners).
- **The table sits inside the text column,** indented by the handle gutter. Obsidian pulls it into the page margin, but the editor has no side padding for the handles to sit in.
