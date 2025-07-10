import { Dict } from '../Dict';
import { Common, NodeType, NodeTypes, Supertype } from '../node_types';
import { Literal, TypeName } from '../typeChecking';
import { CheckableType } from './CheckableType';
import { FlatTypes } from './FlatTypes';

export class CheckableSupertype implements CheckableType, Supertype {
    type: TypeName;
    named: true = true;
    subtypes: Common[];
    subtypeNames: Set<TypeName>;
    subtypeLiterals: Set<Literal>;
    readonly classification = 'SUPERTYPE';

    constructor(type: Supertype, allTypes: NodeType[]) {
        this.type = type.type;
        this.subtypes = type.subtypes;
        let [named, literals] = FlatTypes.fromStubs(this.subtypes, allTypes);
        this.subtypeNames = named;
        this.subtypeLiterals = literals;
    }
}

export type SupertypeMap = Dict<TypeName, CheckableSupertype>;
export namespace SupertypeMap {
    export function fromCategorizedTypes(categorized: NodeTypes.Categorized): SupertypeMap {
        const entries: [TypeName, CheckableSupertype][] = categorized.supertypes
            .map(supertype => new CheckableSupertype(supertype, categorized.all))
            .map(cst => [cst.type, cst]);
        return new Dict(entries);
    }

    export function fromNodeTypes(types: NodeTypes[]): SupertypeMap {
        return fromCategorizedTypes(new NodeTypes.Categorized(types));
    }
}
