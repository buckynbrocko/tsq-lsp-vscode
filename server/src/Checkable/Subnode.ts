import { markupCode, signatureQuantifier } from '../completions_/completions';
import { Dict } from '../Dict';
import { HasSignature } from '../Documentable';
import { Children, Field, Fields } from '../node_types';
import { FieldName, Literal, TypeName } from '../typeChecking';
import { FlatTypes } from './FlatTypes';
import { CheckableNamed } from './Named';
import { SupertypeMap } from './Supertype';

export class CheckableSubnode extends HasSignature {
    constructor(
        public multiple: boolean, //
        public required: boolean,
        public typeNames: Set<TypeName>,
        public literals: Set<Literal>
    ) {
        super();
    }

    static empty() {}

    // static fromChild(child: Field | Children, types: NodeType[]): CheckableSubnode {
    //     let [typeNames, literals] = flatTypeNames(child.types, types);
    //     // let types_: Set<TypeName> = new Set([...typeNames, ...literals]);
    //     return new CheckableSubnode(child.multiple, child.required, typeNames, literals);
    // }

    static fromChildAndSupertypeMap(child: Field | Children, supertypeMap: SupertypeMap): CheckableSubnode {
        let [typeNames, literals] = FlatTypes.fromSupertypeMap(child.types, supertypeMap);
        return new CheckableSubnode(child.multiple, child.required, typeNames, literals);
    }

    get hasLiterals(): boolean {
        return !!this.literals.size;
    }

    get hasNamed(): boolean {
        return !!this.typeNames.size;
    }

    hasTypeName(name: TypeName): boolean {
        return this.typeNames.has(name);
    }

    hasLiteral(literal: Literal): boolean {
        return this.literals.has(literal);
    }

    fieldSignature(name: FieldName) {
        return markupCode(this.fieldSignatureString(name));
    }

    fieldSignatureString(name: FieldName): string {
        let types = this.signatureString();
        let quantifier = signatureQuantifier(this.multiple, this.required);
        let signature = `${name}${quantifier}: ${types}`;
        return signature;
    }

    signatureString(): string {
        return this.subsignatureString();
    }
}
export function isStringLiteral(string_: string): boolean {
    return string_.startsWith('"') && string_.endsWith('"');
}

type CheckableFields = Dict<FieldName, CheckableSubnode>;
export function CheckableFields(fields: Fields, supertypeMap: SupertypeMap): CheckableFields | undefined {
    let entries: [FieldName, CheckableSubnode][] = Object.entries(fields).map(([name, info]) => [
        name as FieldName,
        CheckableSubnode.fromChildAndSupertypeMap(info, supertypeMap),
    ]);
    if (!!entries.length) {
        return new Dict(entries);
    }
}
export type CheckableFieldMap = Dict<FieldName, CheckableSubnode>;
export namespace CheckableFieldMap {
    export function create(named: CheckableNamed[]): CheckableFieldMap {
        let map: CheckableFieldMap = new Dict();
        named.forEach(n => {
            n.fields.forEach((field, name, _) => {
                let entry = map.get(name);
                if (!entry) {
                    map.set(name, field);
                    return;
                }
                entry.addLiterals(...field.literals);
                entry.addTypeNames(...field.typeNames);
                map.set(name, entry);
            });
        });
        return map;
    }
}
