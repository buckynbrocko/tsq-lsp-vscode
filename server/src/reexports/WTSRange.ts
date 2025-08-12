import * as wts from 'web-tree-sitter';
import { WTSPoint } from './Point';
import { TSNode } from './TSNode';

export type WTSRange = wts.Range;
export function WTSRange(startIndex: number, endIndex: number, startPosition: wts.Point, endPosition: wts.Point): wts.Range {
    return { startIndex, endIndex, startPosition, endPosition };
}

export namespace WTSRange {
    export function mock(startIndex: number = 0, endIndex: number = 0): WTSRange {
        return WTSRange(startIndex, endIndex, WTSPoint(0, startIndex), WTSPoint(0, endIndex));
    }

    export function fromNode(node: TSNode): WTSRange {
        return WTSRange(node.startIndex, node.endIndex, node.startPosition, node.endPosition);
    }

    export function betweenNodes(a: TSNode, b: TSNode): WTSRange {
        let [start, end] = a.endIndex <= b.startIndex ? [a, b] : [b, a];
        return {
            startPosition: start.endPosition,
            endPosition: end.startPosition,
            startIndex: start.endIndex,
            endIndex: end.startIndex,
        };
    }

    export function startOfFileToNode(node: TSNode): WTSRange {
        return WTSRange(0, node.startIndex, WTSPoint(0, 0), node.startPosition);
    }

    export function nodeToEndOfFile(node: TSNode, programNode: TSNode): WTSRange {
        return WTSRange(node.endIndex, programNode.endIndex, node.endPosition, programNode.endPosition);
    }

    export function present(range: WTSRange): string {
        if (range.startIndex !== range.endIndex) {
            return `line ${range.startPosition.row + 1}, column ${range.startPosition.column + 1} <-> line ${
                range.endPosition.row + 1
            }, column ${range.endPosition.column + 1}`;
        }
        if (range.startPosition.column !== range.endPosition.column) {
            return `line ${range.startPosition.row + 1}, column ${range.startPosition.column + 1}-${
                range.endPosition.column + 1
            }`;
        }
        return `line ${range.startPosition.row + 1}, column ${range.startPosition.column + 1}`;
    }
}
