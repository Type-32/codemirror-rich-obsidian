export function cursorInNode(cursorFrom: number | undefined, cursorTo: number | undefined, nodeFrom: number | undefined, nodeTo: number | undefined) {
    return ((cursorFrom || 0) >= (nodeFrom || 0) && (cursorFrom || 0) <= (nodeTo || 0)) || ((cursorTo || 0) >= (nodeFrom || 0) && (cursorTo || 0) <= (nodeTo || 0))
}