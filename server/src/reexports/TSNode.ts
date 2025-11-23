import { Node, QueryCapture, QueryMatch } from 'web-tree-sitter';
import * as ts from '../TreeSitter';
import { HasNextSibling, HasNoNextSibling, HasNoPreviousSibling, HasPreviousSibling, isNotNullish } from '../predicates';

// export { Node as TSNode } from 'web-tree-sitter';

export type TSNode = Node;

export namespace TSNode {
    export function containsComments(node: TSNode): boolean {
        return node.type === 'comment' || !!node.descendantsOfType('comment').length;
    }

    export function index(node?: TSNode, ...indices: number[]): TSNode | undefined {
        for (let index of indices) {
            node = node?.children?.at(index) ?? undefined;
        }
        return node;
    }

    export function* yieldNextSiblings(node: TSNode) {
        let next = node.nextSibling ?? undefined;
        while (!!next) {
            yield next;
            next = next.nextSibling ?? undefined;
        }
        return;
    }

    export function nameOfAnonymousNode(node?: TSNode): ['_', true] | [string, false] | undefined {
        let nameNode = node?.childForFieldName('name') ?? undefined;
        switch (nameNode?.type) {
            case '_':
                return ['_', true];
            case 'string':
                let name = stringContent(nameNode);
                return !name ? undefined : [name, false];
            default:
                return;
        }
    }

    export function stringContent(node?: TSNode): string | undefined {
        switch (node?.type) {
            case 'string':
                let content = node.firstNamedChild ?? undefined;
                return content?.type === 'string_content' ? content.text : undefined;
            case 'anonymous_node':
                return stringContent(node.childForFieldName('name') ?? undefined);
            default:
                return;
        }
    }

    export function quantifier(node?: TSNode): '?' | '*' | '+' | undefined {
        let quantifier = node?.childForFieldName('quantifier')?.text;
        switch (quantifier) {
            case '?':
            case '*':
            case '+':
                return quantifier;
            default:
                return;
        }
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

    export function closestDefinitionAncestor(node: TSNode): TSNode | undefined {
        let child: TSNode = node;
        let parent: TSNode | undefined = child.parent ?? undefined;
        while (!!parent) {
            if (isDefinitionChild(parent)) {
                return parent;
            }
            child = parent;
            parent = child.parent ?? undefined;
        }
        return;
    }

    export function isTerminalDefinition(node: TSNode): boolean {
        switch (node.type) {
            case 'anonymous_node':
            case 'negated_field':
            case 'missing_node':
                return true;
        }
        return false;
    }

    export function isPseudoTerminalDefinition(node: TSNode): boolean {
        return isTerminalDefinition(node) || node.type === 'named_node';
    }

    export function isDefinitionChild(node: TSNode) {
        switch (node.type) {
            case 'anonymous_node':
                return true;
            case 'named_node':
            case 'negated_field':
            case 'field_definition':
            case 'missing_node':
            case 'list':
            case 'grouping':
                return node.isNamed;
        }
        return false;
    }

    export function nextSiblingDefinition(node: TSNode): TSNode | undefined {
        let current = node;
        let next = current.nextSibling ?? undefined;
        while (!!next) {
            if (isDefinitionChild(next)) {
                return next;
            }
            current = next;
            next = current.nextSibling ?? undefined;
        }
        return;
    }

    export function childDefinitions(node: TSNode): TSNode[] {
        return node.children.filter(isNotNullish).filter(isDefinitionChild);
    }

    export function nearestDescendantDefinitions(node: TSNode): TSNode[] {
        switch (node.type) {
            case 'list':
            case 'grouping':
            case 'named_node':
            case 'field_definition':
                return childDefinitions(node).flatMap(child =>
                    isPseudoTerminalDefinition(child) ? [child] : nearestDescendantDefinitions(child)
                );
            default:
                return [];
        }
    }

    export function firstPseudoTerminalDescendants(node: TSNode): TSNode[] {
        switch (node.type) {
            case 'list':
                return childDefinitions(node).flatMap(child =>
                    isPseudoTerminalDefinition(child) ? [child] : firstPseudoTerminalDescendants(child)
                );
            case 'grouping':
            case 'named_node':
            case 'field_definition':
                let first = childDefinitions(node).at(0);
                if (!first) {
                    return [];
                }
                return isPseudoTerminalDefinition(first) ? [first] : firstPseudoTerminalDescendants(first);
            default:
                return [];
        }
    }

    export function nextPseudoTerminalSiblings(node: TSNode, root: boolean = false): TSNode[] {
        let parent = root ? undefined : closestDefinitionAncestor(node);

        if (parent?.type === 'list') {
            return nextPseudoTerminalSiblings(parent);
        }

        let next = nextSiblingDefinitions(node).flatMap(sibling =>
            isPseudoTerminalDefinition(sibling) ? [sibling] : firstPseudoTerminalDescendants(sibling)
        );

        if (!!next.length) {
            return next;
        }
        if (!parent) {
            return [];
        }
        root = parent.type === 'named_node';
        return nextPseudoTerminalSiblings(parent, root);
    }

    export function nextSiblingDefinitions(node: TSNode): TSNode[] {
        if (!isDefinitionChild(node)) {
            return [];
        }
        let parent = closestDefinitionAncestor(node);
        if (parent?.type === 'list') {
            return nextSiblingDefinitions(parent);
        }
        let next = nextSiblingDefinition(node);
        switch (next?.type) {
            case undefined:
                break;
            case 'list':
                return nearestDescendantDefinitions(next);
            case 'anonymous_node':
            case 'missing_node':
            case 'field_definition':
            case 'negated_field':
            case 'named_node':
                return [next];
            case 'grouping':
                return nearestDescendantDefinitions(next);
        }
        if (!!parent) {
            return nextSiblingDefinitions(parent);
        }
        return [];
    }
}

export namespace TSNodes {
    export function unique(nodes: TSNode[]): TSNode[] {
        let seen = new Set<number>();
        return nodes.filter(({ id }) => !seen.has(id) && seen.add(id) && true);
    }
    export function nextSiblingDefinitions(nodes: TSNode[]): TSNode[] {
        let nexts = nodes.flatMap(TSNode.nextSiblingDefinitions);
        return TSNodes.unique(nexts);
    }
}
