import type {EditorState} from "@codemirror/state";

export function cursorInNode(cursorFrom: number | undefined, cursorTo: number | undefined, nodeFrom: number | undefined, nodeTo: number | undefined) {
    return ((cursorFrom || 0) >= (nodeFrom || 0) && (cursorFrom || 0) <= (nodeTo || 0)) || ((cursorTo || 0) >= (nodeFrom || 0) && (cursorTo || 0) <= (nodeTo || 0))
}

export function isNodeRangeActive(state: EditorState, nodeFrom: number, nodeTo: number): boolean {
    const cursor = state.selection.main;
    if (cursor.empty) {
        return cursor.from >= nodeFrom && cursor.from <= nodeTo;
    } else {
        return Math.max(nodeFrom, cursor.from) < Math.min(nodeTo, cursor.to);
    }
}