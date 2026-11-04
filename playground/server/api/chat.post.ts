import {
	convertToModelMessages,
	createUIMessageStreamResponse,
	streamText,
	toUIMessageStream,
	type UIMessage,
} from 'ai'
import { editorTools } from '@type32/codemirror-rich-obsidian-editor/ext/ai/tools'

// Host chat: the model (the module's configured endpoint, via the auto-imported `useEditorAiModel`)
// reads the document and proposes edits through `editorTools`, which run in the browser (no
// `execute`) and only change the document if the user accepts.
export default defineEventHandler(async (event) => {
    const { messages } = await readBody<{ messages: UIMessage[] }>(event)
    const result = streamText({
        model: useEditorAiModel(),
        instructions: 'You help the user with the Markdown document open in their editor. Read it with readDocument or readSelection before suggesting changes. '
            + 'Change it only through proposeEdit or proposeInsert; the user reviews every proposal, and the result tells you whether they accepted it.',
        messages: await convertToModelMessages(messages),
        tools: editorTools,
    });

	return createUIMessageStreamResponse({
		stream: toUIMessageStream({ stream: result.stream }),
	})
})
