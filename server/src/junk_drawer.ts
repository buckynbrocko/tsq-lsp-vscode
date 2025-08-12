import { MarkupContent, MarkupKind } from 'vscode-languageserver';
import * as wts from 'web-tree-sitter';
import { Language, Node, Parser } from 'web-tree-sitter';
import { isNotNullish } from './predicates';
import { LSPRange } from './reexports/LSPRange';
import { TSNode } from './reexports/TSNode';

export function revealType<T>(arg: T): void {}

export type Quadruplet<T> = [T, T, T, T];
export type Quadruplets<T> = Quadruplet<T>[];
export namespace Quadruplet {
    export function fromLSPRange(range: LSPRange): Quadruplet<number> {
        return [range.start.line, range.start.character, range.end.line, range.end.character];
    }
}

export type RecursivePartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[]
        ? RecursivePartial<U>[]
        : T[P] extends object | undefined
        ? RecursivePartial<T[P]>
        : T[P];
};

const MAX_DEPTH = 2 ^ 16;

export function depthOf(node?: TSNode | null): number {
    let depth = 0;
    while (!!node && depth < MAX_DEPTH) {
        depth += 1;
        node = node.parent;
    }
    return depth;
}

export function compareDepthOfFirstCaptureNode(a: wts.QueryCapture[], b: wts.QueryCapture[]): number {
    return depthOf(a.at(0)?.node) - depthOf(b.at(0)?.node);
}

export type Attemptable<F> = F extends (...args: (infer A)[]) => infer R
    ? F & { attempt: (...args: A[]) => R | undefined }
    : never;

type PropertyKeyWithValueOfType<O, T, K extends keyof O> = O[K] extends T ? K : never;
type PropertyKeysWithValueOfType<O, T, K extends keyof O = keyof O> = K extends PropertyKeyWithValueOfType<O, T, K> ? K : never;
// type PropertiesOfType<O, T, K extends keyof O = keyof O> = Extract<O, PropertyKeysWithValueOfType<O, T, K>>
type PropertiesOfType<
    O,
    T,
    K extends PropertyKeysWithValueOfType<O, T, keyof O> = PropertyKeysWithValueOfType<O, T, keyof O>
> = { [Key in K]: O[Key] };
// type PropertiesOfType<O, T> = { [Key in keyof O]: O[Key] extends T ? T : never };

export namespace Dummy {
    export function create<T>(args: Partial<T> = {}): T {
        return args as T;
    }
    export function Match(match: Partial<wts.QueryMatch> = {}): wts.QueryMatch {
        return { pattern: 0, patternIndex: 0, captures: [], ...match } satisfies wts.QueryMatch;
    }

    export function Capture(capture: Partial<wts.QueryCapture> = {}): wts.QueryCapture {
        return { patternIndex: 0, name: '', node: Node(), ...capture } satisfies wts.QueryCapture;
    }

    export function Node(node: Partial<TSNode> = {}): TSNode {
        return Dummy.create<TSNode>(node);
    }

    // export function ValueForProperties<O = any, V = any, P extends PropertyKeysWithValueOfType<O, V> = PropertyKeysWithValueOfType<O, V>>(value: V, ...keys: P[]): { [K in typeof keys[number]] : V} {
    export function ValueForProperties<
        O = any,
        V = any
        // P extends PropertyKeysWithValueOfType<O, V> = PropertyKeysWithValueOfType<O, V>
    >(value: V, ...keys: PropertyKeysWithValueOfType<O, V>[]): Extract<PropertiesOfType<O, V>, typeof keys> {
        let entries: [(typeof keys)[number], V][] = keys.map(key => [key, value]);
        let object = Object.fromEntries(entries) as { [K in keyof (typeof keys)[number]]: V };
        return object as Extract<PropertiesOfType<O, V>, typeof keys>;
    }
}

export namespace Identifier {
    export function ofField(field?: TSNode): TSNode | undefined {
        switch (field?.type) {
            case 'field_definition':
                return field.childrenForFieldName('name').filter(isNotNullish).filter(TSNode.isNamed).at(0);
            case 'negated_field':
                return field.namedChildren.filter(isNotNullish).find(child => child.type === 'identifier') ?? undefined;
            default:
                return;
        }
    }

    export function ofNode(node: TSNode): TSNode | undefined {
        if (node.type === 'named_node' || node.type === 'anonymous_node')
            return node.childrenForFieldName('name').filter(isNotNullish).at(0);
        return;
    }
}

/**
 *  @param {Node[]} nodes nodes ascending from most-specific to least-specific
 */
export function formatNodePath(nodes: Node[]): string {
    // return [...nodes]
    return nodes.map(node => (node.isNamed ? node.type : `"${node.type}"`)).join('.');
}

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
