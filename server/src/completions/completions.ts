import * as lsp from 'vscode-languageserver';
import { Tree } from 'web-tree-sitter';
import { CheckableNamed } from '../Checkable/Named';
import { Identifier, markup } from '../junk_drawer';
import { TSNode } from '../reexports';
import { TreeSitter } from '../TreeSitter';
import { FieldName, TypeName } from '../typeChecking';

// TODO add documentation (descriptions & examples) to completions for built-ins

export const WILDCARD: lsp.CompletionItem = {
    label: '_',
    kind: lsp.CompletionItemKind.Keyword,
    documentation: markup(
        'A wildcard node that matches any node. Matches a named node when wrapped in parentheses or an anonymous node when unparenthesized. ex: \n```tree-sitter-query\n(_) ; matches a named node\n _  ; matches an anonymous node\n```'
    ),
};

export const ERROR: lsp.CompletionItem = {
    label: 'ERROR',
    kind: lsp.CompletionItemKind.Constant,
    documentation: markup('A built-in node produced when a parser encounters unrecognized input'),
};

export const MISSING: lsp.CompletionItem = {
    label: 'MISSING',
    kind: lsp.CompletionItemKind.Constant,
    documentation: markup(''),
};

const PREDICATE_STRINGS = [
    '#eq?',
    '#any-eq?',
    '#any-not-eq?',
    '#not-eq?',

    '#any-of?',

    '#is?',
    '#any-is?',
    '#any-is-not?',
    '#is-not?',

    '#match?',
    '#any-match?',
    '#any-not-match?',
    '#not-match?',

    '#set!',
    '#select-adjacent!',
    '#strip!',
];

export const PREDICATES: lsp.CompletionItem[] = PREDICATE_STRINGS.map(string_ => {
    return { label: string_, kind: lsp.CompletionItemKind.Function, documentation: markup(`The \`${string_}\` predicate`) };
});

const DIRECTIVE_STRINGS = ['#set!', '#select-adjacent!', '#strip!'];

export const DIRECTIVES: lsp.CompletionItem[] = DIRECTIVE_STRINGS.map(string_ => {
    return { label: string_, kind: lsp.CompletionItemKind.Function, documentation: markup(`The \`${string_}\` directive`) };
});

export const ALL: lsp.CompletionItem[] = [
    WILDCARD,
    ERROR,
    MISSING,
    //...PREDICATES,
    // ...DIRECTIVES,
];

const PREFIX: string = '```tree-sitter-query\n';
const SUFFIX: string = '\n```';

export function code(text: string): string {
    return PREFIX + text + SUFFIX;
}

export function markupCode(text: string) {
    return markup(code(text));
}

export function nodeDocumentation(type: CheckableNamed): lsp.MarkupContent {
    const signature: string = type.signatureString();
    const value = PREFIX + signature + SUFFIX;
    const content: lsp.MarkupContent = markup(value);
    return content;
}

export function signatureQuantifier(multiple: boolean, required: boolean): string {
    switch (multiple + ' ' + required) {
        case true + ' ' + true:
            return '+';
        case true + ' ' + false:
            return '*';
        case false + ' ' + true:
            return '';
        case false + ' ' + false:
            return '?';
        default:
            console.error('Should not be possible ...');
            return 'ERROR';
    }
}

export enum SimpleCompletionContext {
    UNKNOWN = 'UNKNOWN',
    NONE = 'NONE',
    NAKED = 'NAKED',
    EMPTY_GROUPING = 'EMPTY_GROUPING',
    STRING = 'STRING',
    COMMENT = 'COMMENT',
    CAPTURE = 'CAPTURE',
    HANGING_CAPTURE = 'HANGING_CAPTURE',
}

const _STRINGY = ['string', 'string_content', 'escape_sequence'];

export function isStringy(node: TSNode): boolean {
    return node.isNamed && _STRINGY.includes(node.type);
}

export function isCommenty(node: TSNode): boolean {
    return node.isNamed && node.type === 'comment';
}

const TERMINAL_TYPE_NAMES = [
    '@',
    ':',
    '!',
    'identifier',
    'named_node',
    'grouping',
    'list',
    'program',
    'string_content',
    'string',
] as const;
type TerminalTypeName = (typeof TERMINAL_TYPE_NAMES)[number];
type TerminalNode = TSNode & { type: TerminalTypeName };
namespace TerminalNode {
    export function is(node: TSNode): node is TerminalNode {
        return TERMINAL_TYPE_NAMES.includes(node.type as TerminalTypeName);
    }
}

function terminalNode(node_: TSNode): TerminalNode | undefined {
    for (let node of lineageFromTerminal(node_)) {
        if (TerminalNode.is(node)) {
            return node as TerminalNode;
        }
    }
    return undefined;
}

const ENCLOSING_TYPE_NAMES = ['program', 'capture', 'named_node', 'field_definition', 'negated_field'] as const;
type EnclosingTypeName = (typeof ENCLOSING_TYPE_NAMES)[number];
type EnclosingNode = TSNode & { type: EnclosingTypeName };
namespace EnclosingNode {
    export function is(node: TSNode): node is EnclosingNode {
        return ENCLOSING_TYPE_NAMES.includes(node.type as EnclosingTypeName);
    }
}

function enclosingNode(node_: TSNode): EnclosingNode | undefined {
    for (let node of lineageFromTerminal(node_)) {
        if (EnclosingNode.is(node)) {
            return node;
        }
    }
    return;
}

export type CompletionContext = { type: string };

export type TSQCompletionContext =
    | { type: 'unhandled' }
    | { type: 'none' }
    | { type: 'capture'; identifier?: string }
    | {
          type: 'node' | 'child';
          transform: boolean;
          enclosingNodeType?: TypeName;
      }
    | {
          type: 'field_value';
          transform: boolean;
          fieldName: FieldName;
          parentType?: TypeName;
      }
    | { type: 'negated_field'; parentType?: TypeName }
    | { type: 'field_name'; parentType?: TypeName }
    | { type: 'empty_string'; parentType?: TypeName; fieldName?: FieldName };

export namespace TSQCompletionContext {
    export const UNHANDLED: TSQCompletionContext = { type: 'unhandled' } as const;
    export const NONE: TSQCompletionContext = { type: 'none' } as const;
    export const HANGING_CAPTURE: TSQCompletionContext = { type: 'capture' } as const;
    export const NAKED: TSQCompletionContext = {
        type: 'node',
        transform: true,
    } as const;

    export function fromTree(tree: Tree, params: lsp.CompletionParams, treeSitter: TreeSitter) {
        let completionContext: TSQCompletionContext = TSQCompletionContext.UNHANDLED;
        if (params.position.line === 0 && params.position.character === 0) {
            completionContext = { type: 'node', transform: true };
        } else {
            let node: TSNode | undefined = treeSitter.node_at_position(tree, params.position);
            if (!node) {
                return TSQCompletionContext.NONE;
            }
            // console.debug(`first Node type: ${node.type}`);
            // console.debug(
            //     `position: (${node.startPosition.row},${node.startPosition.column})->(${node.endPosition.row},${node.endPosition.column})`
            // );
            // console.debug(`index: ${node.startIndex}->${node.endIndex}`);
            completionContext = fromNode(node);
        }
        return completionContext;
    }

    export function fromNode(node: TSNode): TSQCompletionContext {
        // console.debug(formatNodePath(lineageFromRoot(node)));

        for (let node_ of lineageFromTerminal(node)) {
            if (isCommenty(node_)) {
                return TSQCompletionContext.NONE;
            }
        }

        // console.debug(nodePath.map(node => node.type));
        // let node = nodePath.pop()!;

        let enclosing = enclosingNode(node);
        // let enclosing = enclosingNode_(nodePath);
        // let terminal = terminalNode_(nodePath);
        let terminal = terminalNode(node);
        if (!terminal || !enclosing) {
            console.error('Should not be possible');
            return TSQCompletionContext.UNHANDLED;
        }

        if (terminal.type === '@') {
            return TSQCompletionContext.HANGING_CAPTURE;
        }
        // If this were Rust or Python I could just use pattern matching fml
        let context = `${enclosing.type}, ${terminal.type}` as const;
        console.debug(context);
        switch (context) {
            case 'program, program':
            case 'program, list':
            case 'program, identifier':
                return TSQCompletionContext.NAKED; // naked node names
            case 'program, grouping': // node names only
                return { type: 'node', transform: false };
            case 'capture, identifier': // other/unique capture names
                return { type: 'capture', identifier: terminal.text };
            case 'named_node, named_node':
                return {
                    type: 'child',
                    enclosingNodeType: TypeName.fromNode(enclosing),
                    transform: true,
                };
            case 'named_node, identifier': // identifier is either named_node.name or a subnode/field name
                if (terminal.id === enclosing.childForFieldName('name')!.id) {
                    return {
                        type: 'node',
                        transform: false,
                    };
                } else {
                    return {
                        type: 'child',
                        enclosingNodeType: TypeName.fromNode(enclosing),
                        transform: true,
                    };
                }

            case 'named_node, grouping': // subnode names only
                return {
                    type: 'child',
                    enclosingNodeType: TypeName.fromNode(enclosing),
                    transform: false,
                };
            case 'named_node, list': // naked subnode/field-name
                return {
                    type: 'child',
                    enclosingNodeType: TypeName.fromNode(enclosing),
                    transform: true,
                };
            case 'field_definition, grouping':
                if (!enclosing.hasError) {
                    const fieldName = FieldName.fromNode(enclosing);
                    // : string | undefined = enclosing
                    // .childrenForFieldName('name')
                    // .filter(node => node?.isNamed)
                    // .shift()?.text;
                    const parentType = TypeName.ofClosestAncestorOfType(TypeName.NAMED_NODE, enclosing);
                    // const parentType: TypeName | undefined = closestAncestorNodeOfType(
                    //     'named_node',
                    //     enclosing
                    // )?.childForFieldName('name')!.text;
                    if (!!fieldName && !!parentType) {
                        // console.debug(`${parentType}.${fieldName}`);
                        return {
                            type: 'field_value',
                            transform: false,
                            fieldName,
                            parentType,
                        };
                    }
                }
            case 'field_definition, named_node': // means the field definition is incomplete
                const fieldNameNode: TSNode | undefined = Identifier.ofField(enclosing);
                if (!fieldNameNode) {
                    return TSQCompletionContext.UNHANDLED;
                }
                const fieldName = FieldName.fromNode(enclosing, fieldNameNode)!;

                const parentType = TypeName.fromNode(terminal);

                return {
                    type: 'field_value',
                    transform: true,
                    fieldName,
                    parentType,
                };

            // identifier is either the field name or inside the field_definition's value
            case 'field_definition, identifier': {
                const fieldNameNode = Identifier.ofField(enclosing);
                // : TSNode | null | undefined = enclosing
                // .childrenForFieldName('name')
                // .filter(node => node?.isNamed)
                // .shift();
                if (!fieldNameNode) {
                    return TSQCompletionContext.NONE;
                }
                const fieldName = FieldName.fromNode(enclosing, fieldNameNode);
                const parentType = TypeName.ofClosestAncestorOfType(TypeName.NAMED_NODE, terminal);
                // nodeName(closestAncestorNodeOfType('named_node' as TypeName, terminal));

                if (fieldNameNode.id === terminal.id) {
                    return {
                        type: 'field_name',
                        parentType,
                    };
                } else if (!!fieldName) {
                    return {
                        type: 'field_value',
                        transform: true,
                        fieldName,
                        parentType,
                    };
                }
                break;
            }
            case 'field_definition, list':
                {
                    const fieldName = FieldName.fromNode(enclosing);
                    // : string | undefined = enclosing
                    // .childrenForFieldName('name')
                    // .filter(node => node?.isNamed)
                    // .shift()?.text;
                    const parentType = TypeName.ofClosestAncestorOfType(TypeName.NAMED_NODE, terminal);
                    // nodeName(closestAncestorNodeOfType('named_node' as TypeName, terminal));
                    if (!!fieldName && !!parentType) {
                        // console.debug(`${parentType}.${fieldName}`);
                        return {
                            type: 'field_value',
                            transform: true,
                            fieldName,
                            parentType,
                        };
                    }
                }
                return TSQCompletionContext.UNHANDLED;
            case 'field_definition, :': {
                // pre-parenthesized field value
                const fieldName: string | undefined = enclosing
                    .childrenForFieldName('name')
                    .filter(node => node?.isNamed)
                    .shift()?.text;
                const parentType = TypeName.ofClosestAncestorOfType(TypeName.NAMED_NODE, enclosing);
                //     closestAncestorNodeOfType('named_node', enclosing)?.childForFieldName(
                //     'name'
                // )!.text;
            }
            case 'named_node, !': // hanging '!'
            case 'negated_field, identifier': //
                {
                    const parentType = TypeName.ofClosestAncestorOfType(TypeName.NAMED_NODE, terminal);
                    //     : TypeName | undefined = nodeName(
                    //     closestAncestorNodeOfType('named_node' as TypeName, terminal)
                    // );
                    if (!!parentType) {
                        return {
                            type: 'negated_field',
                            parentType,
                        };
                    }
                }
                return {
                    type: 'negated_field',
                };
            case 'named_node, string': {
                const parentType = TypeName.ofClosestAncestorOfType(TypeName.NAMED_NODE, terminal);
                // : TypeName | undefined = TypeName.fromNode(closestAncestorNodeOfType(TypeName.NAMED_NODE, terminal));
                if (!!parentType) {
                    return {
                        type: 'empty_string',
                        parentType,
                    };
                }
                return { type: 'empty_string' };
            }
            case 'program, string_content':
            case 'program, string':
            case 'named_node, string_content':
            case 'field_definition, string_content':
            case 'field_definition, string': {
                const fieldName = FieldName.fromNode(enclosing);
                if (!fieldName) {
                    return { type: 'empty_string' };
                }
                let parent = closestAncestorOfType(enclosing, TypeName.NAMED_NODE);
                let parentType = TypeName.fromNode(parent);
                if (!parentType) {
                    return {
                        type: 'empty_string',
                        fieldName,
                    };
                }

                return {
                    type: 'empty_string',
                    fieldName,
                    parentType,
                };
            }
            // Supposedly impossible states:
            case 'capture, named_node':
            case 'program, named_node':
            case 'capture, string':
            case 'capture, string_content':
            case 'negated_field, string':
            case 'negated_field, program':
            case 'negated_field, named_node':
            case 'negated_field, :':
            case 'negated_field, !':
            case 'negated_field, grouping':
            case 'negated_field, list':
            case 'negated_field, string_content':
            case 'capture, !':
            case 'field_definition, !':
            case 'capture, :':
            case 'capture, grouping':
            case 'capture, list':
            case 'capture, program':
            case 'field_definition, program':
            case 'named_node, :':
            case 'named_node, program':
            case 'program, :':
                console.error(`Supposedly impossible completion context is possible: '${context}'`);
            // invalid state:
            case 'program, !':
                return TSQCompletionContext.NONE;
            default:
                console.debug(`Unhandled completionContext: "${context}"`);
                return TSQCompletionContext.UNHANDLED;
        }
        return TSQCompletionContext.UNHANDLED;
    }
}

export function lineageFromRoot(node: TSNode): TSNode[] {
    return [...lineageFromTerminal(node)].reverse();
}

export function* lineageFromTerminal(node: TSNode) {
    let current: TSNode | null = node;
    while (current !== null) {
        yield current;
        current = current.parent;
    }
    return undefined;
}
export function* ascendAncestors(node?: TSNode) {
    let current: TSNode | null | undefined = node?.parent;
    while (!!current) {
        yield current;
        current = current.parent;
    }
    return undefined;
}

// export function closestAncestorNodeOfTypes(types: string[], node: TSNode): TSNode | undefined {
//     for (let parent of ascendAncestors(node)) {
//         if (types.includes(parent.type)) {
//             return parent;
//         }
//     }
//     return undefined;
// }

// export function closestAncestorNodeOfType(type: string, node?: undefined): undefined;
// export function closestAncestorNodeOfType<T extends string>(type: T, node?: TSNode): (TSNode & { type: T }) | undefined;
// export function closestAncestorNodeOfType(type: string, node?: TSNode): TSNode | undefined {
//     if (!node) {
//         return;
//     }
//     for (let parent of ascendAncestors(node)) {
//         if (parent.type === type) {
//             return parent;
//         }
//     }
//     return undefined;
// }
export function closestAncestorOfType<T extends string>(node?: TSNode, ...types: T[]): (TSNode & { type: T }) | undefined;
export function closestAncestorOfType(node?: undefined, ...types: string[]): undefined;
export function closestAncestorOfType(node?: TSNode, ...types: string[]): TSNode | undefined;
export function closestAncestorOfType(node?: TSNode, ...types: string[]): TSNode | undefined {
    for (let parent of ascendAncestors(node)) {
        if (types.includes(parent.type)) {
            return parent;
        }
    }
    return;
}

// export function nameOfClosestAncestorOfType<T extends string>(type: T, node?: TSNode): T | undefined {
// export function nameOfClosestAncestorOfType(type: string, node?: TSNode): TypeName | undefined {
//     return TypeName.fromNode(closestAncestorNodeOfType(type, node));
// }

// export function isOnlyInstanceOfCaptureName(map?: Capture.Map, name?: string) {
//     return !!name && map?.get(name)?.length === 1;
// }
