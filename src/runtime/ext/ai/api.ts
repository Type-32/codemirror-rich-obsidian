// Everything `/ext/ai` exports except `aiAssistant`. Imports neither `ai` nor `@ai-sdk/vue`, so the
// no-peer fallback (`unavailable.ts`) can export the same names.
export { acceptProposal, aiField, discardProposal, openAi, propose, type AiAssistantOptions, type Proposal, type ProposalResult } from './state'
export { buildPrompt, cursorPresets, selectionPresets, type AiPreset, type ProposalMode } from './prompt'
export { isEditorTool, runEditorTool } from './run-tool'
