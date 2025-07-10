import * as lsp from 'vscode-languageserver';
import { MarkupContent, MarkupKind } from 'vscode-languageserver';
import * as wts from 'web-tree-sitter';
import { Language, Node, Parser, Node as TSNode } from 'web-tree-sitter';
import { castUnchecked, isNotNullish } from './predicates';

export function enumNames<E extends {}>(enum_: E) {
    return Object.keys(enum_)
        .filter(m => Number.isNaN(Number(m)))
        .map(castUnchecked<keyof E>);
}

export namespace Identifier {
    export function ofField(field?: TSNode): TSNode | undefined {
        switch (field?.type) {
            case 'field_definition':
                return field.childrenForFieldName('name').filter(isNotNullish).filter(NodeIsNamed).at(0);
            case 'negated_field':
                return field.firstNamedChild ?? undefined;
            default:
                return;
        }
    }

    export function ofNode(node: TSNode): TSNode | undefined {
        if (node.type === 'named_node' || node.type === 'anonymous_node')
            return node.childrenForFieldName('name').filter(isNotNullish).at(0);
    }
}

export { Node as TSNode } from 'web-tree-sitter';

/**
 *  @param {Node[]} nodes nodes ascending from most-specific to least-specific
 */
export function formatNodePath(nodes: Node[]): string {
    // return [...nodes]
    return nodes.map(node => (node.isNamed ? node.type : `"${node.type}"`)).join('.');
}

export function revealType<T>(arg: T): void {}

export async function newParser(): Promise<Parser> {
    await Parser.init();
    return new Parser();
}

export async function newLanguage(path: string): Promise<Language> {
    await Parser.init();
    return Language.load(path);
}

export function markup(value: string): MarkupContent {
    return {
        kind: MarkupKind.Markdown,
        value: value,
    };
}

export type LSPRange = lsp.Range;
export namespace LSPRange {
    export function fromNode(node: TSNode): LSPRange {
        return {
            start: { line: node.startPosition.row, character: node.startPosition.column },
            end: { line: node.endPosition.row, character: node.endPosition.column },
        };
    }

    export function fromNodePair(start: TSNode, end: TSNode): LSPRange {
        return {
            start: { line: start.startPosition.row, character: start.startPosition.column },
            end: { line: end.endPosition.row, character: end.endPosition.column },
        };
    }
}

export function* walkTree(tree: wts.Tree) {
    let cursor = tree.walk();
    const limit = 1000;
    let count = 0;
    let seen: number[] = [];
    // yield cursor;
    while (count < limit) {
        count += 1;
        if (seen.includes(cursor.currentNode.id)) {
            if (!(cursor.gotoNextSibling() || cursor.gotoParent())) {
                return;
            }
        } else {
            seen.push(cursor.currentNode.id);
            yield cursor;
            cursor.gotoFirstChild() || cursor.gotoNextSibling() || cursor.gotoParent();
        }
    }
    return;
}

export function _formatTree(tree: wts.Tree): string {
    let lines: string[] = [];
    let lastDepth = 0;
    for (let cursor of walkTree(tree)) {
        if (cursor.currentDepth <= lastDepth && !!lines.length) {
            let line = lines.pop()!;
            line += ')'.repeat(Math.min(1, lastDepth - cursor.currentDepth));
            lines.push(line);
        }
        let indentation = !!cursor.currentDepth ? '   '.repeat(cursor.currentDepth - 1) + '   ' : '';
        let open = cursor.nodeIsNamed ? '(' : '';
        let close = cursor.nodeIsNamed && cursor.currentNode.childCount === 0 ? ')' : '';
        let field = cursor.currentFieldName?.concat(': ') || '';
        let type = cursor.nodeIsNamed ? cursor.nodeType : `"${cursor.nodeType}"`;
        let missing = cursor.nodeIsMissing ? ' (MISSING)' : '';
        lines.push(indentation + field + open + type + close + missing);
        lastDepth = cursor.currentDepth;
    }
    if (!!lines.length) {
        let line = lines.pop()!;
        line += ')'.repeat(Math.min(2, lastDepth));
        lines.push(line);
    }
    return lines.join('\n');
}

export function NodeIsNamed(node: TSNode): boolean {
    return node.isNamed;
}
