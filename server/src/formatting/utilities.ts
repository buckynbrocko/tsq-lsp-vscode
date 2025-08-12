import { isNotNullish, isNotTypeFn } from '../predicates';
import { TSNode } from '../reexports';
import { FormattingContext } from './Context';
import { FormattingStyle } from './Style';

export function childCanBeInlined(node: TSNode, arg1: undefined): never;
export function childCanBeInlined(node: undefined, arg1: undefined): never;
export function childCanBeInlined(node: TSNode, arg1: FormattingStyle | FormattingContext): boolean;
export function childCanBeInlined(node?: TSNode, arg1?: FormattingStyle | FormattingContext): boolean;
export function childCanBeInlined(node?: TSNode, arg1?: FormattingStyle | FormattingContext): boolean {
    if (!node) {
        return false;
    }
    if (!arg1) {
        throw 'options must be defined';
    }
    const style: FormattingStyle = !(arg1 instanceof FormattingContext) ? arg1 : arg1.style;

    if (!node.isNamed) {
        return true;
    }
    switch (node.type) {
        case 'escape_sequence':
        case 'string':
        case 'string_content':
        case 'identifier':
        case 'quantifier':
        case 'capture':
        case 'anonymous_node':
        case 'predicate_type':
            return true;
        case 'comment':
        case 'program':
            return false;
        case 'field_definition':
        case 'missing_node':
        case 'predicate':
            return style.predicates.allowInline && innerChildrenOf(node).every(child => childCanBeInlined(child, style));
        case 'negated_field':
            return !TSNode.containsComments(node);
        case 'grouping':
        case 'list':
        case 'named_node':
        case 'parameters': {
            const children: TSNode[] = innerChildrenOf(node);
            const max: number | undefined = style.maxChildren(node.type);
            return !exceedsMaxInlineChildren(children, max) && children.every(child => childCanBeInlined(child, style));
        }
    }
    return false;
}

// export function maxInlineChildren(type: string, style: FormattingStyle): number | undefined {
//     switch (type) {
//         case 'grouping':
//             return style.maxInlineGroupingElements;
//         case 'list':
//             return style.maxInlineListElements;
//         case 'named_node':
//             return style.maxInlineNamedNodeElements;
//         case 'parameters':
//             return style.maxInlineParameterElements;
//     }
//     return undefined;
// }

export function exceedsMaxInlineChildren(children: TSNode[], max?: number): boolean {
    return max !== undefined && children.length > max;
}

function innerChildrenOf(node: TSNode): TSNode[] {
    let exceptedIDs: number[] = [];
    if (node.type === 'named_node') {
        const name = node.childForFieldName('name');
        name && exceptedIDs.push(name.id);
    }
    return node.children
        .filter(isNotNullish)
        .filter(isNotTypeFn('(', ')', '[', ']', '/', ':', '!', 'capture', 'identifier', 'quantifier'))
        .filter(n => !exceptedIDs.includes(n.id));
}
