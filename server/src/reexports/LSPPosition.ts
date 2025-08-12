import * as lsp from 'vscode-languageserver';
import * as wts from 'web-tree-sitter';

export type LSPPosition = lsp.Position;
export function LSPPosition(line: number, character: number): LSPPosition {
    return { line, character };
}
export namespace LSPPosition {
    export function fromPoint(point: wts.Point): LSPPosition {
        return LSPPosition(point.row, point.column);
    }

    export function present(position: LSPPosition): string {
        return `line ${position.line + 1}, column ${position.character + 1}`;
    }

    export function comparator(a: LSPPosition, b: LSPPosition): number {
        return a.line - b.line || a.character - b.character;
    }

    export namespace Pair {
        export function areEqual(a: LSPPosition, b: LSPPosition): boolean {
            return !comparator(a, b);
        }
    }
}
