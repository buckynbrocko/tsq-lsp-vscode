import { Stream } from 'itertools-ts';
import * as lsp from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { iterutil } from '../itertools';
import { LSPRange } from '../reexports/LSPRange';

export type LSPTextEdit = lsp.TextEdit;
export type LSPTextEdits = Iterable<LSPTextEdit>;
export namespace LSPTextEdit {
    export function comparator(a: lsp.TextEdit, b: lsp.TextEdit): number {
        return LSPRange.comparator(a.range, b.range);
    }

    export function is(object: any): object is lsp.TextEdit {
        return lsp.TextEdit.is(object);
    }

    export namespace Pair {
        export function interfere(a: LSPTextEdit, b: LSPTextEdit): boolean {
            return LSPRange.Pair.interfere(a.range, b.range);
        }
    }
}

export function attemptEdits(text: string, ...edits: lsp.TextEdit[]): string | undefined {
    let sorted = edits.sort(LSPTextEdit.comparator).reverse();
    const interfering = Stream.of(sorted)
        .combinations(2)
        .filter(([a, b]) => !!a && !!b && LSPTextEdit.Pair.interfere(a, b));
    const interferes = iterutil(sorted)
        .pairwise()
        .some(([a, b]) => LSPTextEdit.Pair.interfere(a, b));
    if (interfering) {
        // console.warn('interferance!!');
        for (let [a, b] of interfering) {
            a && b && console.debug(LSPRange.Pair.present(a.range, b.range));
        }
        // return undefined;
    }
    let document = TextDocument.create('', '', 0, text);
    let result = TextDocument.applyEdits(document, sorted);

    return result;
}
