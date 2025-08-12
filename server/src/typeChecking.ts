import { closestAncestorOfType } from './completions/completions';
import { Identifier } from './junk_drawer';
import { TSNode } from './reexports';

export type TypeName = Brand<string, 'TypeName'>;
export function TypeName(string_: string): TypeName {
    return string_ as TypeName;
}

export type Parenthesized<TN extends TypeName = TypeName> = `(${TN})`;

export namespace TypeName {
    export const NAMED_NODE = TypeName('named_node');

    export function parenthesize(name: TypeName): Parenthesized<typeof name> {
        return `(${name})`;
    }

    export function deparenthesize(name: Parenthesized<TypeName>): TypeName {
        return name.substring(1, name.length - 1) as TypeName;
    }

    export function fromIdentifier(identifier: TSNode): TypeName;
    export function fromIdentifier(identifier: undefined): undefined;
    export function fromIdentifier(identifier?: TSNode): TypeName | undefined {
        return identifier?.text as TypeName;
    }
    export function fromNode(node: TSNode, identifier: TSNode): TypeName;
    export function fromNode(node?: TSNode, identifier?: TSNode): TypeName | undefined;
    export function fromNode(node?: undefined, identifier?: undefined): undefined;
    export function fromNode(node?: TSNode, identifier?: TSNode): TypeName | undefined {
        if (!node) {
            return undefined;
        }
        identifier = identifier ?? Identifier.ofNode(node);
        if (!identifier) {
            return undefined;
        }
        if (node.type === 'named_node') {
            return (!identifier.isNamed ? '_' : identifier.text) as TypeName;
        } else if (node.type === 'anonymous_node') {
            return (!identifier.isNamed ? '_' : identifier.firstNamedChild?.text) as TypeName;
        }
        return undefined;
    }

    export function ofClosestAncestorOfType(type: string, node?: TSNode): TypeName | undefined {
        return fromNode(closestAncestorOfType(node, type));
    }

    export function ofClosestAncestorOfTypes(node?: TSNode, ...types: string[]): TypeName | undefined {
        return fromNode(closestAncestorOfType(node, ...types));
    }
}
export type FieldName = Brand<string, 'FieldName'>;
export namespace FieldName {
    export function fromNode(field?: TSNode, identifier?: TSNode): FieldName | undefined;
    export function fromNode(field: TSNode, identifier: TSNode): FieldName;
    export function fromNode(field: undefined, identifier: undefined): undefined;
    export function fromNode(field?: TSNode, identifier?: TSNode): FieldName | undefined {
        return (identifier ?? Identifier.ofField(field))?.text as FieldName | undefined;
    }

    export function fromIdentifier(identifier: TSNode): FieldName;
    export function fromIdentifier(identifier: undefined): undefined;
    export function fromIdentifier(identifier?: TSNode): FieldName | undefined {
        return identifier?.text as FieldName;
    }
}

export type Literal = Brand<string, 'Literal'>;
export namespace Literal {
    export function dequote(text: string): Literal {
        if (text.length < 2) {
            return text as Literal;
        }
        let first = text.at(0);
        let last = text.at(Math.min(0, text.length - 1));
        if (!first || !last) {
            return text as Literal;
        }
        if (first === last) {
            return text.substring(1, text.length - 1) as Literal;
        }
        ('');
        return text as Literal;
    }
    export function quote(literal: Literal): QuotedLiteral<typeof literal> {
        return ('"' + literal.replace('"', '\\\\"') + '"') as QuotedLiteral<typeof literal>;
    }
}

export type QuotedLiteral<L extends string = string> = `"${L}"`;

export const _ = Symbol();
export type Brand<V, T> = V & { [_]: T };

function brand<V, T>(arg: V, tag_: T): Brand<V, T> {
    return arg as Brand<V, T>;
}
export function unionString(names: string[]): string {
    switch (names.length) {
        case 0:
            return '';
        case 1:
            return names[0]!;
        default:
            return '[ ' + names.join(' ') + ' ]';
    }
}
