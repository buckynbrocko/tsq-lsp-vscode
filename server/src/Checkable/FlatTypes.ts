import { Dict } from '../Dict';
import { NodeType, Stub, Supertype } from '../node_types';
import { Literal, TypeName } from '../typeChecking';
import { CheckableSupertype, SupertypeMap } from './Supertype';

export type FlatTypes = [Set<TypeName>, Set<Literal>];

export namespace FlatTypes {
    export function fromSupertypeMap(types: NodeType[], supertypeMap: SupertypeMap): FlatTypes {
        let named: Set<TypeName> = new Set();
        let literals: Set<Literal> = new Set();
        for (let type of types) {
            const name = type.type;
            if (NodeType.isLiteral(type)) {
                literals.add(type.type);
            } else if (supertypeMap.has(name as TypeName)) {
                let supertype: CheckableSupertype = supertypeMap.get(name as TypeName)!;
                supertype.subtypeLiterals.forEach(literal => literals.add(literal));
                supertype.subtypeNames.forEach(subtype => named.add(subtype));
            } else {
                named.add(name as TypeName);
            }
        }
        return [named, literals];
    }

    export function fromStubs(subset: Stub[], allTypes: NodeType[]): FlatTypes {
        let literals: Set<Literal> = new Set(subset.filter(NodeType.isLiteral).map(l => l.type));
        let names: TypeName[] = subset.filter(NodeType.isNamed).map(n => n.type);
        let allSupertypeNames: TypeName[] = allTypes.filter(NodeType.isSupertype).map(st => st.type);

        if (!allSupertypeNames.some(stn => names.includes(stn))) {
            return [new Set(names), literals];
        }

        let typeNames: Set<TypeName> = new Set();
        let allSupertypes: Dict<TypeName, FlatTypes> = new Dict(
            allTypes.filter(NodeType.isSupertype).map(st => [st.type, FlatTypes.fromSupertypeStub(st, allTypes)])
        );

        for (let name of names) {
            let supertype: FlatTypes | undefined = allSupertypes.get(name);
            if (!!supertype) {
                const [namedSubtypes, literalSubtypes] = supertype;
                namedSubtypes.forEach(n => typeNames.add(n));
                literalSubtypes.forEach(l => literals.add(l));
            } else {
                typeNames.add(name);
            }
        }
        return [typeNames, literals];
    }

    export function fromSupertypeStub(supertypeStub: Stub, allTypes: NodeType[]): FlatTypes {
        let supertype: Supertype | undefined = allTypes
            .filter(t => t.type === supertypeStub.type)
            .filter(NodeType.isSupertype)
            .at(0);
        if (!supertype) {
            return [new Set(), new Set()];
        }
        let literals: Set<Literal> = new Set(supertype.subtypes.filter(NodeType.isLiteral).map(l => l.type));
        let names: TypeName[] = supertype.subtypes.filter(NodeType.isNamed).map(n => n.type);
        let allSupertypes: Dict<TypeName, Supertype> = new Dict(allTypes.filter(NodeType.isSupertype).map(st => [st.type, st]));
        let typeNames = new Set<TypeName>();

        if (!names.some(name => allSupertypes.has(name))) {
            typeNames = new Set(names);
            return [typeNames, literals];
        }

        let seenSupertypes = new Set<TypeName>();
        let subtypeName: TypeName | Literal | undefined = names.pop();
        const MAX_ITERATIONS = 500;
        let iterations = 0;
        while (iterations < MAX_ITERATIONS && !!subtypeName) {
            iterations += 1;
            iterations === MAX_ITERATIONS &&
                console.warn(`Maximum iterations of ${MAX_ITERATIONS} reached for supertype ${supertypeStub.type}`);
            const superSubtype: Supertype | undefined = allSupertypes.get(subtypeName);
            if (!superSubtype) {
                typeNames.add(subtypeName);
            } else if (!seenSupertypes.has(subtypeName)) {
                seenSupertypes.add(subtypeName);
                for (let subtype of superSubtype.subtypes) {
                    let name = subtype.type;
                    if (NodeType.isLiteral(subtype)) {
                        literals.add(subtype.type);
                    } else if (allSupertypes.has(name as TypeName)) {
                        names.push(name as TypeName);
                    } else {
                        typeNames.add(name as TypeName);
                    }
                }
            }
            subtypeName = names.pop();
        }

        return [typeNames, literals];
    }
}
