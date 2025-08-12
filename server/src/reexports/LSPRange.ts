import * as lsp from 'vscode-languageserver';
import * as wts from 'web-tree-sitter';
import { LSPPosition } from './LSPPosition';
import { TSNode } from './TSNode';
import { WTSRange } from './WTSRange';

export type LSPRange = lsp.Range;
export function LSPRange(start: lsp.Position, end: lsp.Position): LSPRange {
    return { start, end };
}

export namespace LSPRange {
    export function present(range: LSPRange): string {
        if (range.start.line !== range.end.line) {
            return `line ${range.start.line + 1}, column ${range.start.character + 1} <-> line ${range.end.line + 1}, column ${
                range.end.character + 1
            }`;
        }
        if (range.start.character !== range.end.character) {
            return `line ${range.start.line + 1}, column ${range.start.character + 1}-${range.end.character + 1}`;
        }
        return `line ${range.start.line + 1}, column ${range.start.character + 1}`;
    }

    export function fromWTSRange(range: WTSRange): LSPRange {
        return LSPRange(LSPPosition.fromPoint(range.startPosition), LSPPosition.fromPoint(range.endPosition));
    }

    export function fromNode(node: TSNode): LSPRange {
        return LSPRange(LSPPosition.fromPoint(node.startPosition), LSPPosition.fromPoint(node.endPosition));
        return {
            start: { line: node.startPosition.row, character: node.startPosition.column },
            end: { line: node.endPosition.row, character: node.endPosition.column },
        };
    }

    export function fromPosition(position: LSPPosition): LSPRange {
        return { start: position, end: position };
    }

    export function fromQuadruplet(startLine: number, startCharacter: number, endLine: number, endCharacter: number): LSPRange {
        if (startLine < 0) throw `Parameter 'startLine' must not be negative. Given value: ${startLine}`;
        if (startCharacter < 0) throw `Parameter 'startCharacter' must not be negative. Given value: ${startCharacter}`;
        if (endLine < 0) throw `Parameter 'endLine' must not be negative. Given value: ${endLine}`;
        if (endCharacter < 0) throw `Parameter 'endCharacter' must not be negative. Given value: ${endCharacter}`;
        return fromQuadruplet.unchecked(startLine, startCharacter, endLine, endCharacter);
    }

    export namespace fromQuadruplet {
        export function unchecked(startLine: number, startCharacter: number, endLine: number, endCharacter: number): LSPRange {
            return LSPRange(LSPPosition(startLine, startCharacter), LSPPosition(endLine, endCharacter));
        }

        export function attempt(
            startLine: number,
            startCharacter: number,
            endLine: number,
            endCharacter: number
        ): LSPRange | undefined {
            try {
                return fromQuadruplet(startLine, startCharacter, endLine, endCharacter);
            } catch (e) {
                console.log(e);
            }
            return;
        }
    }

    export function isPoint(range: LSPRange): boolean {
        return range.start.line === range.end.line && range.start.character === range.end.character;
    }

    export function fromPoint(point: wts.Point): LSPRange {
        const position = LSPPosition.fromPoint(point);
        return LSPRange(position, position);
    }

    export function startOfFileToNode(node: TSNode): LSPRange {
        return LSPRange(LSPPosition(0, 0), LSPPosition.fromPoint(node.startPosition));
    }

    export function nodeToEndOfFile(node: TSNode, programNode: TSNode): LSPRange {
        return LSPRange(LSPPosition.fromPoint(node.endPosition), LSPPosition.fromPoint(programNode.endPosition));
    }

    export function lineStartToNode(node: TSNode): LSPRange {
        return LSPRange(LSPPosition(node.startPosition.row, 0), LSPPosition.fromPoint(node.startPosition));
    }

    export function leftOverlap(a: TSNode, b: TSNode): LSPRange {
        let [start, end] = a.endIndex <= b.startIndex ? [a, b] : [b, a];
        return LSPRange(LSPPosition.fromPoint(start.startPosition), LSPPosition.fromPoint(end.startPosition));
    }

    export function betweenNodes(a: TSNode, b: TSNode): LSPRange {
        let [start, end] = a.endIndex <= b.startIndex ? [a, b] : [b, a];
        return {
            start: { line: start.endPosition.row, character: start.endPosition.column },
            end: { line: end.startPosition.row, character: end.startPosition.column },
        };
    }

    export function aroundNodes(start: TSNode, end: TSNode): LSPRange {
        return {
            start: { line: start.startPosition.row, character: start.startPosition.column },
            end: { line: end.endPosition.row, character: end.endPosition.column },
        };
    }

    export function comparator(a: LSPRange, b: LSPRange): number {
        let aSign = Math.sign(LSPPosition.comparator(a.start, a.end));
        let bSign = Math.sign(LSPPosition.comparator(b.start, b.end));
        return !!(aSign && bSign && aSign !== bSign)
            ? LSPPosition.comparator(a.end, b.start) || LSPPosition.comparator(a.start, b.end)
            : LSPPosition.comparator(a.end, b.end) || LSPPosition.comparator(a.start, b.start);
    }

    export namespace Pair {
        export function present(a: LSPRange, b: LSPRange): string {
            return `[${LSPRange.present(a)}, ${LSPRange.present(b)}]`;
        }
        export function areEqual(a: LSPRange, b: LSPRange): boolean {
            return !comparator(a, b);
        }

        export function doNotInterfere(a: LSPRange, b: LSPRange): boolean {
            const aEndsBeforeBStarts = LSPPosition.comparator(a.end, b.start) <= 0;
            const bEndsBeforeAStarts = LSPPosition.comparator(b.end, a.start) <= 0;
            const areNotEqual = !areEqual(a, b);
            return areNotEqual && (aEndsBeforeBStarts || bEndsBeforeAStarts);
        }

        export function interfere(a: LSPRange, b: LSPRange): boolean {
            let result = !doNotInterfere(a, b);
            // if (result) {
            //     console.debug(present(a, b));
            // }
            return !doNotInterfere(a, b);
        }
    }
}
