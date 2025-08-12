import * as lsp from 'vscode-languageserver';
import { TSNode, WTSRange } from '../reexports';
import { LSPRange } from '../reexports/LSPRange';
import { WTSPoint } from '../reexports/Point';

export type Edits = Edit[];

export type MaybeEdit = Edit | undefined;
export type MaybeEdits = (Edit | undefined)[];

export interface Edit {
    readonly type: string;
    isRedundant: boolean;
    toTextEdit(): lsp.TextEdit;
    present(): string;
}

export namespace Edit {
    export function is(object: any): object is Edit {
        return object instanceof Insertion || object instanceof Replacement || object instanceof Deletion;
    }

    export function isRedundant(edit: Edit): boolean {
        return edit.isRedundant;
    }
}

export function newEdit(range: WTSRange): Deletion;
export function newEdit<T extends string>(content: T, point: T extends '' ? never : WTSPoint): T extends '' ? never : Insertion;
export function newEdit<T extends string>(
    content: T,
    range: T extends '' ? never : WTSRange
): T extends '' ? never : Replacement;
export function newEdit(
    arg0: string | WTSRange,
    arg1?: WTSPoint | WTSRange | undefined
): Insertion | Deletion | Replacement | never {
    if (typeof arg0 !== 'string') {
        return new Deletion(arg0);
    }
    if (arg0 === '') {
        throw 'Empty content not allowed';
    }
    if (arg1 === undefined) {
        throw 'Point or Range must be provided';
    }
    return WTSPoint.is(arg1) ? new Insertion(arg0, arg1) : new Replacement(arg0, arg1);
}

export class Insertion implements Edit {
    readonly type: 'Insertion' = 'Insertion';
    constructor(public content: string, public point: WTSPoint, public isRedundant: boolean = false) {}

    toTextEdit(): lsp.TextEdit {
        return {
            newText: this.content,
            range: LSPRange.fromPoint(this.point),
        };
    }

    present(): string {
        const length = this.content.length;
        return `Insertion ${length}ch @ ${WTSPoint.present(this.point)}}`;
    }
}

export class Deletion implements Edit {
    readonly type: 'Deletion' = 'Deletion';
    constructor(public range: WTSRange, public isRedundant: boolean = false) {}

    toTextEdit(): lsp.TextEdit {
        return {
            newText: '',
            range: LSPRange.fromWTSRange(this.range),
        };
    }
    present(): string {
        return `Deletion @ ${WTSRange.present(this.range)}}`;
    }
}

export class Replacement implements Edit {
    readonly type: 'Replacement' = 'Replacement';
    constructor(public content: string, public range: WTSRange, public isRedundant: boolean = false) {}

    toTextEdit(): lsp.TextEdit {
        return {
            newText: this.content,
            range: LSPRange.fromWTSRange(this.range),
        };
    }
    present(): string {
        return `Replacement ${this.content.length}ch @ ${WTSRange.present(this.range)}}`;
    }
}

export namespace format {
    function pair(former: TSNode, latter: TSNode, newlines: number, spaces: number): MaybeEdit {
        if (newlines === 0) {
            return space.pair(former, latter, spaces);
        }
        if (spaces === 0) {
            return linesBetween.pair(former, latter, newlines);
        }
        const newText: string = '\n'.repeat(newlines) + ' '.repeat(spaces);
        const range = WTSRange.betweenNodes(former, latter);
        const rowDifference: number = TSNode.Pair.rowDifferenceBetween(former, latter);
        const indexDifference: number = TSNode.Pair.indexDifferenceBetween(former, latter);
        const isRedundant = rowDifference === newlines && indexDifference === newlines + spaces;
        return new Replacement(newText, range, isRedundant);
    }

    export function previous(node: TSNode, newlines: number, spaces: number): MaybeEdit {
        return node.previousSibling ? pair(node.previousSibling, node, newlines, spaces) : undefined;
    }

    export function next(node: TSNode, newlines: number, spaces: number): MaybeEdit {
        return node.nextSibling ? pair(node, node.nextSibling, newlines, spaces) : undefined;
    }
}

export namespace remove {
    export function before(node: TSNode): Edit {
        const isRedundant = node.startIndex === 0;
        return new Deletion(WTSRange.startOfFileToNode(node), isRedundant);
    }

    export function after(node: TSNode, programNode: TSNode): Edit {
        const isRedundant = node.endIndex === programNode.endIndex && programNode.text.endsWith('\n');
        return new Replacement('\n', WTSRange.nodeToEndOfFile(node, programNode), isRedundant);
    }
}

export namespace connect {
    export function pair(former: TSNode, latter: TSNode): MaybeEdit {
        return space.pair(former, latter, 0);
    }

    export function previous(node: TSNode): MaybeEdit {
        return node.previousSibling ? pair(node.previousSibling, node) : undefined;
    }

    export function next(node: TSNode): MaybeEdit {
        return node.nextSibling ? pair(node, node.nextSibling) : undefined;
    }
}

export namespace replace {
    export function between(former: TSNode, latter: TSNode, newText: string = '', isRedundant: boolean = false): Edit {
        return new Replacement(newText, WTSRange.betweenNodes(former, latter), isRedundant);
    }
}

export namespace space {
    export function pair(former: TSNode, latter: TSNode, count: number = 1): MaybeEdit {
        if (former.type === 'comment') {
            return;
        }
        const isRedundant =
            TSNode.Pair.indexDifferenceBetween(former, latter) === count &&
            TSNode.Pair.rowDifferenceBetween(former, latter) === 0;
        return replace.between(former, latter, ' '.repeat(count), isRedundant);
    }

    export function previous(node: TSNode, count: number = 1): MaybeEdit {
        return node.previousSibling ? pair(node.previousSibling, node, count) : undefined;
    }

    export function next(node: TSNode, count: number = 1): MaybeEdit {
        return node.nextSibling ? pair(node, node.nextSibling, count) : undefined;
    }
}

export namespace linesBetween {
    export function pair(former: TSNode, latter: TSNode, count: number = 1): Edit {
        const isRedundant =
            TSNode.Pair.rowDifferenceBetween(former, latter) === count &&
            TSNode.Pair.indexDifferenceBetween(former, latter) === count;
        return replace.between(former, latter, '\n'.repeat(count), isRedundant);
    }

    export function previous(node: TSNode, count: number = 1): MaybeEdit {
        return node.previousSibling ? linesBetween.pair(node.previousSibling, node, count) : undefined;
    }

    export function next(node: TSNode, count: number = 1): MaybeEdit {
        return node.nextSibling ? linesBetween.pair(node, node.nextSibling, count) : undefined;
    }
}
