import { Node, QueryCapture, QueryMatch } from 'web-tree-sitter';
import * as ts from '../TreeSitter';
import { HasNextSibling, HasNoNextSibling, HasNoPreviousSibling, HasPreviousSibling } from '../predicates';

// export { Node as TSNode } from 'web-tree-sitter';

export type TSNode = Node;

export namespace TSNode {
    export function containsComments(node: TSNode): boolean {
        return node.type === 'comment' || !!node.descendantsOfType('comment').length;
    }

    export function rowsBetweenPrevious(node: HasPreviousSibling): number;
    export function rowsBetweenPrevious(
        node: TSNode
    ): typeof node extends HasNoPreviousSibling<typeof node> ? undefined : number;
    export function rowsBetweenPrevious(node: TSNode): number | undefined {
        if (!node.previousSibling) {
            return;
        }
        return Pair.rowDifferenceBetween(node.previousSibling, node);
    }

    export function rowsBetweenNext(node: HasNextSibling): number;
    export function rowsBetweenNext(node: HasNoNextSibling): undefined;
    export function rowsBetweenNext(node: TSNode): typeof node extends HasNoNextSibling ? undefined : number;
    export function rowsBetweenNext(node: TSNode): number | undefined {
        if (!node.nextSibling) {
            return;
        }
        return Pair.rowDifferenceBetween(node, node.nextSibling);
    }

    export function CompareSiblings(a: TSNode, b: TSNode): number {
        return a.startIndex - b.startIndex;
    }

    export function isNamed(node: TSNode): boolean {
        return node.isNamed;
    }

    export function ofCaptureWithName(arg: QueryCapture[] | QueryMatch, name: string): TSNode | undefined {
        return ts.Capture.withName(arg, name)?.node;
    }

    export function presentType(node: TSNode): string;
    export function presentType(node?: undefined): undefined;
    export function presentType(node?: TSNode): string | undefined;
    export function presentType(node?: TSNode): string | undefined {
        if (!!node) {
            return node.isNamed ? `(${node.type})` : `"${node.type}"`;
        }
        return;
    }

    export namespace Pair {
        export function rowDifferenceBetween(former: TSNode, latter: TSNode): number {
            return latter.startPosition.row - former.endPosition.row;
        }

        export function indexDifferenceBetween(former: TSNode, latter: TSNode): number {
            return latter.startIndex - former.endIndex;
        }
    }
}
