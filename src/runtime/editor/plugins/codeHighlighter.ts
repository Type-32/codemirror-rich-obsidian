import { tagHighlighter, tags as t } from '@lezer/highlight'

/**
 * Syntax tokens inside code blocks → `cm-code-<category>` classes, coloured in CSS by `--code-<category>`
 * (Obsidian's variable names), so the palette is plain CSS. Categories follow Obsidian's mapping:
 * variables use the property colour, properties/types/builtins the function colour, definitions stay normal.
 */
export const codeHighlighter = tagHighlighter([
    { tag: [t.comment, t.meta], class: 'cm-code-comment' },
    { tag: t.keyword, class: 'cm-code-keyword' },
    { tag: [t.literal, t.atom, t.null, t.unit], class: 'cm-code-value' },
    { tag: [t.string, t.regexp, t.escape, t.special(t.string)], class: 'cm-code-string' },
    { tag: t.operator, class: 'cm-code-operator' },
    { tag: t.punctuation, class: 'cm-code-punctuation' },
    { tag: t.tagName, class: 'cm-code-tag' },
    { tag: [t.propertyName, t.typeName, t.className, t.namespace, t.macroName, t.standard(t.variableName), t.special(t.variableName)], class: 'cm-code-function' },
    { tag: t.variableName, class: 'cm-code-property' },
    { tag: t.definition(t.variableName), class: 'cm-code-normal' },
    { tag: t.invalid, class: 'cm-code-important' },
])
