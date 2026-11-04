// Server-safe: imports only `ai`. Pass to `streamText({ tools: editorTools })` in the host's chat route;
// they have no `execute`, so calls reach the browser, where `runEditorTool` runs them.
import { jsonSchema, tool } from 'ai'

const empty = jsonSchema<Record<string, never>>({ type: 'object', properties: {}, additionalProperties: false })

export const editorTools = {
    readDocument: tool({
        description: 'Read the full Markdown document the user is editing.',
        inputSchema: empty,
    }),
    readSelection: tool({
        description: 'Read the text the user has selected (empty when nothing is selected) and the text around it.',
        inputSchema: empty,
    }),
    proposeEdit: tool({
        description: 'Propose replacing one passage of the document. The user reviews the change and accepts or rejects it; '
            + 'the document only changes if they accept. The result tells you which.',
        inputSchema: jsonSchema<{ find: string, replace: string }>({
            type: 'object',
            properties: {
                find: { type: 'string', description: 'The passage to replace, copied verbatim from the document. Must occur exactly once.' },
                replace: { type: 'string', description: 'The new Markdown text.' },
            },
            required: ['find', 'replace'],
            additionalProperties: false,
        }),
    }),
    proposeInsert: tool({
        description: 'Propose inserting new text. The user reviews it and accepts or rejects it. '
            + 'Start `text` with a blank line ("\\n\\n") to add it as a new paragraph.',
        inputSchema: jsonSchema<{ text: string, after?: string }>({
            type: 'object',
            properties: {
                text: { type: 'string', description: 'The Markdown text to insert.' },
                after: { type: 'string', description: 'Insert right after this passage, copied verbatim; it must occur exactly once. Omit to insert at the user\'s cursor.' },
            },
            required: ['text'],
            additionalProperties: false,
        }),
    }),
}

export type EditorToolName = keyof typeof editorTools
